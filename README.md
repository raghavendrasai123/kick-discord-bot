# Kick Survival Discord Bot

Transform server moderation into a gamified survival experience. New members start a countdown; fail to act and they’re “kicked” into roleplay zones where they complete tasks, earn XP/tokens, and climb leaderboards to regain privileges.

[![Discord.js](https://img.shields.io/badge/Discord.js-14-5865F2?logo=discord&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![MongoDB](https://img.shields.io/badge/MongoDB-6%2B-47A248?logo=mongodb&logoColor=white)](#)

---

## Overview
- Survival timer with automated DMs and reminders
- Soft “kick” via role assignment (no actual bans)
- Redemption via configurable task system (quiz, meme, raid, wheel, dare)
- XP and token economy with bribes/extensions
- Real-time leaderboards and progression roles

Use this bot to increase engagement, onboard creatively, and keep moderation fun.

---

## Features
- Survival core
  - 24h configurable countdown with reminder schedule
  - DM welcomes, reminders, and kick notices
  - Role-based access after “kick” (e.g., Jail, Shadow Realm)
- Tasks & economy
  - Task types: quiz, meme, raid, wheel, dare (+ custom)
  - Rewards: XP and tokens; token bribes extend time
  - Availability: difficulty, cooldowns, requirements, expirations
- Community systems
  - Voting (save/doom), alliances, token trading (optional)
- Leaderboards
  - Survivors, XP, tokens, achievements; seasonal support

---

## Tech Stack
- Node.js 18+
- Discord.js v14
- MongoDB (Mongoose)

---

## Quick Start
1) Clone and install
```bash
git clone <repository-url>
cd kick-discord-bot
npm install
```

2) Configure environment
Copy `env.example` to `.env` and fill in values.

3) Run
```bash
npm start
```

---

## Configuration
Environment variables (see `env.example` for full list):

| Key | Description | Example |
| --- | --- | --- |
| DISCORD_TOKEN | Bot token | x.y.z |
| DISCORD_CLIENT_ID | App/client ID | 1234567890 |
| DISCORD_GUILD_ID | Default guild ID | 1234567890 |
| MONGODB_URI | Mongo connection string | mongodb://localhost:27017/survival_bot |
| KICK_TIMER_HOURS | Hours before kick | 24 |
| REMINDER_INTERVALS | Hours list for reminders | 8,4,1 |
| DEFAULT_XP_REWARD | Default XP per task | 100 |
| DEFAULT_TOKEN_REWARD | Default tokens per task | 50 |
| ANNOUNCEMENT_CHANNEL_ID | Kick announcements channel | 123... |
| KICKED_ROLE_ID | Role assigned on kick (optional if using by name) | 123... |

Roles you’ll likely want:
- `Kicked` (restricted)
- `Advanced Survivor` (perks)
- `Hall of Fame` (recognition)

Suggested channels:
- Public: `#general`, `#announcements`, `#hall-of-fame`
- Kicked-only: `#jail`, `#shadow-realm`, `#cryosleep`, `#kicked-common-room`
- Advanced: `#survivor-lounge`, `#elite-tasks`, `#survivor-leaderboard`

---

## Commands (Slash)
- `/survive` – Show your status, time remaining, XP, tokens
- `/tasks` – List active tasks and rewards
- `/leaderboard` – Show top survivors
- `/bribe <amount>` – Spend tokens to extend survival
- `/wheel` – Spin for random outcomes
- `/vote <user> <save|doom>` – Community vote

Admin commands:
- `/admin-add-task` – Create a task (type, title, description)
- `/admin-reset-user <user>` – Reset user state

---

## Data Model (Simplified)
```javascript
User {
  userId, guildId, joinTime, kickTime,
  currentRole: 'normal'|'kicked'|'advanced_survivor'|'hall_of_fame',
  survivalCount, totalXP, tokens,
  remindersSent: Number[], achievements[], alliances[], voteHistory[]
}

Task {
  taskId, type, title, description,
  rewardXP, rewardTokens, active, difficulty,
  requirements: { minSurvivalCount, minXP, roleRestriction },
  completionData, cooldown, maxCompletions, tags
}

Leaderboard {
  guildId, type, entries[{ userId, value, rank, additionalData }],
  season, metadata
}
```

---

## Deployment
- Local: `npm start`
- PM2 (example):
```bash
npm i -g pm2
pm2 start npm --name kick-survival-bot -- start
pm2 save
```
- Docker (example):
```dockerfile
# simple example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

---

## Roadmap
- Seasonal events, richer task flows, better voting & alliance UX
- Optional web dashboard for analytics and configuration
- Extensible plugin API for custom task types

---

## Contributing
Issues and PRs welcome. Please:
- Use conventional commits if possible
- Add/adjust tests where relevant
- Keep code readable and typed where applicable

---

## License
MIT

---

## Support
- Telegram: `@lorine93s`
- Open an issue on GitHub
