const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['survivors', 'xp', 'longest_streak', 'tokens', 'achievements', 'tasks_completed'],
    required: true 
  },
  entries: [{
    userId: { type: String, required: true },
    username: String, // Cached username for performance
    value: { type: Number, required: true },
    rank: { type: Number, required: true },
    additionalData: {
      survivalCount: Number,
      totalXP: Number,
      tokens: Number,
      currentRole: String,
      lastActivity: Date
    }
  }],
  lastUpdated: { type: Date, default: Date.now },
  season: { type: String, default: 'current' }, // For seasonal leaderboards
  metadata: {
    totalParticipants: { type: Number, default: 0 },
    averageValue: { type: Number, default: 0 },
    topValue: { type: Number, default: 0 }
  }
});

// Indexes
leaderboardSchema.index({ guildId: 1, type: 1, season: 1 }, { unique: true });
leaderboardSchema.index({ guildId: 1, lastUpdated: -1 });

// Virtual for top performers
leaderboardSchema.virtual('topThree').get(function() {
  return this.entries.slice(0, 3);
});

// Virtual for user's rank
leaderboardSchema.virtual('userRank').get(function() {
  return function(userId) {
    const entry = this.entries.find(e => e.userId === userId);
    return entry ? entry.rank : null;
  };
});

// Methods
leaderboardSchema.methods.updateEntry = function(userId, value, additionalData = {}) {
  const existingEntry = this.entries.find(e => e.userId === userId);
  
  if (existingEntry) {
    existingEntry.value = value;
    existingEntry.additionalData = { ...existingEntry.additionalData, ...additionalData };
  } else {
    this.entries.push({
      userId,
      value,
      rank: this.entries.length + 1,
      additionalData
    });
  }
  
  // Re-sort and update ranks
  this.sortAndRank();
  this.lastUpdated = new Date();
  
  return this.save();
};

leaderboardSchema.methods.sortAndRank = function() {
  // Sort by value (descending)
  this.entries.sort((a, b) => b.value - a.value);
  
  // Update ranks
  this.entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  // Update metadata
  this.metadata.totalParticipants = this.entries.length;
  this.metadata.averageValue = this.entries.length > 0 
    ? this.entries.reduce((sum, entry) => sum + entry.value, 0) / this.entries.length 
    : 0;
  this.metadata.topValue = this.entries.length > 0 ? this.entries[0].value : 0;
};

leaderboardSchema.methods.getUserEntry = function(userId) {
  return this.entries.find(e => e.userId === userId);
};

leaderboardSchema.methods.getTopEntries = function(limit = 10) {
  return this.entries.slice(0, limit);
};

leaderboardSchema.methods.getEntriesAroundUser = function(userId, range = 2) {
  const userIndex = this.entries.findIndex(e => e.userId === userId);
  if (userIndex === -1) return [];
  
  const start = Math.max(0, userIndex - range);
  const end = Math.min(this.entries.length, userIndex + range + 1);
  
  return this.entries.slice(start, end);
};

// Static methods
leaderboardSchema.statics.createOrUpdate = async function(guildId, type, userData) {
  const leaderboard = await this.findOne({ guildId, type, season: 'current' });
  
  if (leaderboard) {
    await leaderboard.updateEntry(userData.userId, userData.value, userData.additionalData);
    return leaderboard;
  } else {
    const newLeaderboard = new this({
      guildId,
      type,
      entries: [{
        userId: userData.userId,
        value: userData.value,
        rank: 1,
        additionalData: userData.additionalData
      }],
      metadata: {
        totalParticipants: 1,
        averageValue: userData.value,
        topValue: userData.value
      }
    });
    
    return await newLeaderboard.save();
  }
};

leaderboardSchema.statics.updateAllLeaderboards = async function(guildId, users) {
  const leaderboardTypes = ['survivors', 'xp', 'tokens', 'achievements'];
  
  for (const type of leaderboardTypes) {
    const leaderboard = await this.findOne({ guildId, type, season: 'current' });
    
    if (leaderboard) {
      // Clear existing entries
      leaderboard.entries = [];
      
      // Add all users
      for (const user of users) {
        let value = 0;
        const additionalData = {
          survivalCount: user.survivalCount,
          totalXP: user.totalXP,
          tokens: user.tokens,
          currentRole: user.currentRole,
          lastActivity: user.lastTaskCompletion || user.joinTime
        };
        
        switch (type) {
          case 'survivors':
            value = user.survivalCount;
            break;
          case 'xp':
            value = user.totalXP;
            break;
          case 'tokens':
            value = user.tokens;
            break;
          case 'achievements':
            value = user.achievements.length;
            break;
        }
        
        leaderboard.entries.push({
          userId: user.userId,
          value,
          rank: 0, // Will be set by sortAndRank
          additionalData
        });
      }
      
      leaderboard.sortAndRank();
      await leaderboard.save();
    }
  }
};

leaderboardSchema.statics.getLeaderboard = async function(guildId, type, season = 'current') {
  return await this.findOne({ guildId, type, season });
};

leaderboardSchema.statics.getAllLeaderboards = async function(guildId, season = 'current') {
  return await this.find({ guildId, season });
};

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
