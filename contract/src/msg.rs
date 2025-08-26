use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::Addr;

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub owner: Option<Addr>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    AddQuest {
        id: u64,
        operation: String,
    },
    SubmitSolution {
        quest_id: u64,
        sub_question_index: u8,
        solution: u64,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetQuest { id: u64, sub_question_index: Option<u8> },
    GetUserBadges { user: Addr },
    GetUserProgress { user: Addr, quest_id: u64 },
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct QueryAnswer {
    pub operation: Option<String>,
    pub a: Option<u64>,
    pub b: Option<u64>,
    pub badges: Option<Vec<u64>>,
    pub sub_questions: Option<Vec<SubQuestionAnswer>>,
    pub progress: Option<Vec<bool>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct SubQuestionAnswer {
    pub operation: String,
    pub a: u64,
    pub b: u64,
}