use schemars::JsonSchema;
use secret_toolkit::storage::{Item, Keymap};
use serde::{Deserialize, Serialize};
use cosmwasm_std::CanonicalAddr;

// Owner storage
pub static OWNER_KEY: &[u8] = b"owner";
pub static OWNER: Item<CanonicalAddr> = Item::new(OWNER_KEY);

// Token count for badges
pub static TOKEN_COUNT_KEY: &[u8] = b"token_count";
pub static TOKEN_COUNT: Item<u64> = Item::new(TOKEN_COUNT_KEY);

// Quests storage: Map quest ID to Quest struct
pub static QUESTS_KEY: &[u8] = b"quests";
pub static QUESTS: Keymap<u64, Quest> = Keymap::new(QUESTS_KEY);

// Completions storage: Track user completions by (user, quest_id)
pub static COMPLETIONS_KEY: &[u8] = b"completions";
pub static COMPLETIONS: Keymap<(CanonicalAddr, u64), bool> = Keymap::new(COMPLETIONS_KEY);

// User progress: Track which sub-questions are answered by (user, quest_id)
pub static USER_PROGRESS_KEY: &[u8] = b"user_progress";
pub static USER_PROGRESS: Keymap<(CanonicalAddr, u64), Vec<bool>> = Keymap::new(USER_PROGRESS_KEY);

// Badges storage: Map token ID to Badge struct
pub static BADGES_KEY: &[u8] = b"badges";
pub static BADGES: Keymap<u64, Badge> = Keymap::new(BADGES_KEY);

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct SubQuestion {
    pub operation: String, // "+", "-", "*", "/"
    pub a: u64,
    pub b: u64,
    pub answer: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct Quest {
    pub sub_questions: Vec<SubQuestion>, // 5 sub-questions
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct Badge {
    pub owner: CanonicalAddr,
    pub quest_id: u64,
    pub token_uri: String,
}