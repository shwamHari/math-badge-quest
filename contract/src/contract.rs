use cosmwasm_std::{
    entry_point, to_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult, Addr,
};
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryAnswer, QueryMsg, SubQuestionAnswer};
use crate::state::{BADGES, COMPLETIONS, OWNER, QUESTS, TOKEN_COUNT, USER_PROGRESS, Badge, Quest, SubQuestion};
use sha2::{Digest, Sha256};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    let owner = msg.owner.unwrap_or(info.sender);
    let owner_canon = deps.api.addr_canonicalize(owner.as_str())?;
    OWNER.save(deps.storage, &owner_canon)?;
    TOKEN_COUNT.save(deps.storage, &0)?;
    Ok(Response::default())
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    match msg {
        ExecuteMsg::AddQuest { id, operation } => try_add_quest(deps, env, info, id, operation),
        ExecuteMsg::SubmitSolution { quest_id, sub_question_index, solution } => {
            try_submit_solution(deps, env, info, quest_id, sub_question_index, solution)
        }
    }
}

pub fn try_add_quest(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    id: u64,
    operation: String,
) -> StdResult<Response> {
    let sender_address = info.sender.clone();
    let owner = deps.api.addr_humanize(&OWNER.load(deps.storage)?)?;
    if sender_address != owner {
        return Err(StdError::generic_err("Only the owner can add quests"));
    }
    if QUESTS.get(deps.storage, &id).is_some() {
        return Err(StdError::generic_err("Quest ID already exists"));
    }

    // Generate 5 sub-questions
    let mut sub_questions = Vec::with_capacity(5);
    let random_seed = env.block.random.ok_or(StdError::generic_err("No randomness available"))?.0;

    for i in 0..5 {
        // Unique seed for each sub-question
        let seed = [
            random_seed.clone(),
            id.to_be_bytes().to_vec(),
            operation.as_bytes().to_vec(),
            (i as u8).to_be_bytes().to_vec(),
        ].concat();
        let mut hasher = Sha256::new();
        hasher.update(&seed);
        let hash = hasher.finalize();
        let a_part = u64::from_le_bytes(hash[0..8].try_into().map_err(|_| StdError::generic_err("Hash slice error"))?);
        let b_part = u64::from_le_bytes(hash[8..16].try_into().map_err(|_| StdError::generic_err("Hash slice error"))?);

        let (a, b) = match operation.as_str() {
            "+" | "*" => {
                let a = (a_part % 100) + 1; // Range 1-100
                let b = (b_part % 100) + 1;
                (a, b)
            }
            "-" => {
                let mut a = (a_part % 100) + 1;
                let mut b = (b_part % 100) + 1;
                if a < b {
                    std::mem::swap(&mut a, &mut b); // Ensure a >= b
                }
                (a, b)
            }
            "/" => {
                let b = (b_part % 10) + 1; // b from 1-10
                let k = (a_part % 10) + 1; // multiplier 1-10
                let a = b * k; // Ensure a is divisible by b
                (a, b)
            }
            _ => return Err(StdError::generic_err("Invalid operation")),
        };

        let answer = match operation.as_str() {
            "+" => a + b,
            "-" => a - b,
            "*" => a * b,
            "/" => a / b,
            _ => unreachable!(),
        };

        sub_questions.push(SubQuestion { operation: operation.clone(), a, b, answer });
    }

    let quest = Quest { sub_questions };
    QUESTS.insert(deps.storage, &id, &quest)?;
    Ok(Response::default())
}

pub fn try_submit_solution(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    quest_id: u64,
    sub_question_index: u8,
    solution: u64,
) -> StdResult<Response> {
    let quest = QUESTS.get(deps.storage, &quest_id)
        .ok_or_else(|| StdError::generic_err("Quest not found"))?;
    let sender_addr = deps.api.addr_canonicalize(info.sender.as_str())?;
    let completion_key = (sender_addr.clone(), quest_id);

    // Validate sub-question index
    if sub_question_index as usize >= quest.sub_questions.len() {
        return Err(StdError::generic_err("Invalid sub-question index"));
    }

    // Check if quest is already completed
    if COMPLETIONS.get(deps.storage, &completion_key).is_some() {
        return Err(StdError::generic_err("Quest already completed by user"));
    }

    // Get or initialise user progress
    let progress_key = (sender_addr.clone(), quest_id);
    let mut progress = USER_PROGRESS.get(deps.storage, &progress_key).unwrap_or(vec![false; 5]);

    // Check if sub-question was already answered
    if progress[sub_question_index as usize] {
        return Err(StdError::generic_err("Sub-question already answered"));
    }

    // Verify solution
    let sub_question = &quest.sub_questions[sub_question_index as usize];
    if solution != sub_question.answer {
        return Err(StdError::generic_err("Incorrect solution"));
    }

    // Mark sub-question as answered
    progress[sub_question_index as usize] = true;
    USER_PROGRESS.insert(deps.storage, &progress_key, &progress)?;

    // Check if all sub-questions are answered
    if progress.iter().all(|&answered| answered) {
        // Log progress to confirm state
        deps.storage.set(b"debug_progress", &serde_json::to_vec(&progress).unwrap_or_default());
        let token_id = TOKEN_COUNT.load(deps.storage)? + 1;
        TOKEN_COUNT.save(deps.storage, &token_id)?;
        let badge = Badge {
            owner: sender_addr,
            quest_id,
            token_uri: format!("ipfs://math_quest/{}/{}", sub_question.operation, token_id),
        };
        BADGES.insert(deps.storage, &token_id, &badge)?;
        COMPLETIONS.insert(deps.storage, &completion_key, &true)?;
    }

    Ok(Response::default())
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetQuest { id, sub_question_index } => to_binary(&query_quest(deps, id, sub_question_index)?),
        QueryMsg::GetUserBadges { user } => to_binary(&query_user_badges(deps, user)?),
        QueryMsg::GetUserProgress { user, quest_id } => to_binary(&query_user_progress(deps, user, quest_id)?),
    }
}

fn query_quest(deps: Deps, id: u64, sub_question_index: Option<u8>) -> StdResult<QueryAnswer> {
    let quest = QUESTS.get(deps.storage, &id)
        .ok_or_else(|| StdError::generic_err("Quest not found"))?;

    match sub_question_index {
        Some(idx) => {
            if idx as usize >= quest.sub_questions.len() {
                return Err(StdError::generic_err("Invalid sub-question index"));
            }
            let sub = &quest.sub_questions[idx as usize];
            Ok(QueryAnswer {
                operation: Some(sub.operation.clone()),
                a: Some(sub.a),
                b: Some(sub.b),
                badges: None,
                sub_questions: None,
                progress: None,
            })
        }
        None => {
            let sub_questions = quest.sub_questions.iter().map(|sub| SubQuestionAnswer {
                operation: sub.operation.clone(),
                a: sub.a,
                b: sub.b,
            }).collect();
            Ok(QueryAnswer {
                operation: None,
                a: None,
                b: None,
                badges: None,
                sub_questions: Some(sub_questions),
                progress: None,
            })
        }
    }
}

fn query_user_badges(deps: Deps, user: Addr) -> StdResult<QueryAnswer> {
    let user_addr = deps.api.addr_canonicalize(user.as_str())?;
    let badges: Vec<u64> = BADGES
        .iter(deps.storage)?
        .filter_map(|result| match result {
            Ok((token_id, badge)) if badge.owner == user_addr => Some(token_id),
            _ => None,
        })
        .collect();
    Ok(QueryAnswer {
        operation: None,
        a: None,
        b: None,
        badges: Some(badges),
        sub_questions: None,
        progress: None,
    })
}

fn query_user_progress(deps: Deps, user: Addr, quest_id: u64) -> StdResult<QueryAnswer> {
    let user_addr = deps.api.addr_canonicalize(user.as_str())?;
    let progress_key = (user_addr, quest_id);
    let progress = USER_PROGRESS.get(deps.storage, &progress_key).unwrap_or(vec![false; 5]);
    Ok(QueryAnswer {
        operation: None,
        a: None,
        b: None,
        badges: None,
        sub_questions: None,
        progress: Some(progress),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::*;
    use cosmwasm_std::{from_binary, Coin, Uint128, Api};

    #[test]
    fn proper_initialization() -> StdResult<()> {
        let mut deps = mock_dependencies();
        let info = mock_info(
            "creator",
            &[Coin {
                denom: "earth".to_string(),
                amount: Uint128::new(1000),
            }],
        );
        let init_msg = InstantiateMsg { owner: None };

        let res = instantiate(deps.as_mut(), mock_env(), info.clone(), init_msg)?;
        assert_eq!(0, res.messages.len());

        let owner = deps.api.addr_humanize(&OWNER.load(&deps.storage)?)?;
        assert_eq!(owner, info.sender);
        Ok(())
    }

    #[test]
    fn add_quest() {
        let mut deps = mock_dependencies();
        let info = mock_info(
            "creator",
            &[Coin {
                denom: "earth".to_string(),
                amount: Uint128::new(1000),
            }],
        );
        let init_msg = InstantiateMsg { owner: None };
        instantiate(deps.as_mut(), mock_env(), info.clone(), init_msg).unwrap();

        let mut env = mock_env();
        env.block.random = Some(Binary(vec![1, 2, 3, 4]));
        let exec_msg = ExecuteMsg::AddQuest {
            id: 1,
            operation: "+".to_string(),
        };
        let _res = execute(deps.as_mut(), env, info.clone(), exec_msg).unwrap();

        let res = query(deps.as_ref(), mock_env(), QueryMsg::GetQuest { id: 1, sub_question_index: Some(0) }).unwrap();
        let value: QueryAnswer = from_binary(&res).unwrap();
        assert_eq!(value.operation, Some("+".to_string()));
        assert!(value.a.is_some());
        assert!(value.b.is_some());
    }

    #[test]
    fn submit_solution() {
        let mut deps = mock_dependencies();
        let info = mock_info(
            "creator",
            &[Coin {
                denom: "earth".to_string(),
                amount: Uint128::new(1000),
            }],
        );
        let init_msg = InstantiateMsg { owner: None };
        instantiate(deps.as_mut(), mock_env(), info.clone(), init_msg).unwrap();

        let mut env = mock_env();
        env.block.random = Some(Binary(vec![1, 2, 3, 4]));
        let add_msg = ExecuteMsg::AddQuest {
            id: 1,
            operation: "+".to_string(),
        };
        execute(deps.as_mut(), env.clone(), info.clone(), add_msg).unwrap();

        let user_info = mock_info(
            "user",
            &[Coin {
                denom: "earth".to_string(),
                amount: Uint128::new(500),
            }],
        );

        // Submit solutions for all 5 sub-questions
        for idx in 0..5 {
            let res = query(deps.as_ref(), env.clone(), QueryMsg::GetQuest { id: 1, sub_question_index: Some(idx) }).unwrap();
            let quest: QueryAnswer = from_binary(&res).unwrap();
            let correct_answer = quest.a.unwrap() + quest.b.unwrap();

            let exec_msg = ExecuteMsg::SubmitSolution {
                quest_id: 1,
                sub_question_index: idx,
                solution: correct_answer,
            };
            let _res = execute(deps.as_mut(), env.clone(), user_info.clone(), exec_msg).unwrap();
        }

        let res = query(deps.as_ref(), mock_env(), QueryMsg::GetUserBadges { user: user_info.sender }).unwrap();
        let value: QueryAnswer = from_binary(&res).unwrap();
        assert_eq!(value.badges, Some(vec![1]));
    }

    #[test]
    fn user_progress() {
        let mut deps = mock_dependencies();
        let info = mock_info(
            "creator",
            &[Coin {
                denom: "earth".to_string(),
                amount: Uint128::new(1000),
            }],
        );
        let init_msg = InstantiateMsg { owner: None };
        instantiate(deps.as_mut(), mock_env(), info.clone(), init_msg).unwrap();

        let mut env = mock_env();
        env.block.random = Some(Binary(vec![1, 2, 3, 4]));
        let add_msg = ExecuteMsg::AddQuest {
            id: 1,
            operation: "+".to_string(),
        };
        execute(deps.as_mut(), env.clone(), info.clone(), add_msg).unwrap();

        let user_info = mock_info(
            "user",
            &[Coin {
                denom: "earth".to_string(),
                amount: Uint128::new(500),
            }],
        );

        // Submit solutions for first 2 sub questions
        for idx in 0..2 {
            let res = query(deps.as_ref(), env.clone(), QueryMsg::GetQuest { id: 1, sub_question_index: Some(idx) }).unwrap();
            let quest: QueryAnswer = from_binary(&res).unwrap();
            let correct_answer = quest.a.unwrap() + quest.b.unwrap();

            let exec_msg = ExecuteMsg::SubmitSolution {
                quest_id: 1,
                sub_question_index: idx,
                solution: correct_answer,
            };
            execute(deps.as_mut(), env.clone(), user_info.clone(), exec_msg).unwrap();
        }

        // Check user progress
        let res = query(deps.as_ref(), env.clone(), QueryMsg::GetUserProgress { user: user_info.sender, quest_id: 1 }).unwrap();
        let value: QueryAnswer = from_binary(&res).unwrap();
        assert_eq!(value.progress, Some(vec![true, true, false, false, false]));
    }
}