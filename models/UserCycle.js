const mongoose = require('mongoose');

// Updated schema for the gamified survival system
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  joinTime: { type: Date, default: Date.now },
  kickTime: { type: Date },
  currentRole: { 
    type: String, 
    enum: ['normal', 'kicked', 'advanced_survivor', 'hall_of_fame'],
    default: 'normal' 
  },
  survivalCount: { type: Number, default: 0 },
  totalXP: { type: Number, default: 0 },
  tokens: { type: Number, default: 100 },
  lastTaskCompletion: { type: Date },
  kickMessages: [{ type: String }],
  remindersSent: [{ type: Number }],
  achievements: [{ 
    name: String,
    earnedAt: { type: Date, default: Date.now },
    description: String
  }],
  alliances: [{ 
    userId: String,
    allianceType: { type: String, enum: ['temporary', 'permanent'] },
    createdAt: { type: Date, default: Date.now }
  }],
  voteHistory: [{
    targetUserId: String,
    action: { type: String, enum: ['save', 'doom'] },
    votedAt: { type: Date, default: Date.now }
  }]
});

// Indexes for performance
userSchema.index({ userId: 1, guildId: 1 }, { unique: true });
userSchema.index({ guildId: 1, survivalCount: -1 });
userSchema.index({ guildId: 1, totalXP: -1 });
userSchema.index({ guildId: 1, currentRole: 1 });

// Virtual for time remaining
userSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const timeSinceJoin = now.getTime() - this.joinTime.getTime();
  const kickTimerMs = 24 * 60 * 60 * 1000; // 24 hours
  return Math.max(0, kickTimerMs - timeSinceJoin);
});

// Virtual for survival status
userSchema.virtual('survivalStatus').get(function() {
  if (this.currentRole === 'kicked') return 'kicked';
  if (this.timeRemaining <= 0) return 'ready_to_kick';
  return 'safe';
});

// Methods
userSchema.methods.addXP = function(amount) {
  this.totalXP += amount;
  return this.save();
};

userSchema.methods.addTokens = function(amount) {
  this.tokens += amount;
  return this.save();
};

userSchema.methods.spendTokens = function(amount) {
  if (this.tokens >= amount) {
    this.tokens -= amount;
    return this.save();
  }
  return false;
};

userSchema.methods.addAchievement = function(name, description) {
  this.achievements.push({ name, description });
  return this.save();
};

userSchema.methods.formAlliance = function(userId, type = 'temporary') {
  this.alliances.push({ userId, allianceType: type });
  return this.save();
};

userSchema.methods.vote = function(targetUserId, action) {
  this.voteHistory.push({ targetUserId, action });
  return this.save();
};

module.exports = mongoose.model('User', userSchema);