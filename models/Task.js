const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    enum: ['quiz', 'meme', 'raid', 'wheel', 'dare', 'custom'],
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  rewardXP: { type: Number, default: 100 },
  rewardTokens: { type: Number, default: 50 },
  active: { type: Boolean, default: true },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard', 'extreme'],
    default: 'medium'
  },
  requirements: {
    minSurvivalCount: { type: Number, default: 0 },
    minXP: { type: Number, default: 0 },
    roleRestriction: { 
      type: String, 
      enum: ['normal', 'kicked', 'advanced_survivor', 'hall_of_fame'],
      default: 'kicked'
    }
  },
  completionData: {
    // For quiz tasks
    questions: [{
      question: String,
      options: [String],
      correctAnswer: Number,
      explanation: String
    }],
    // For meme tasks
    memeCategories: [String],
    // For raid tasks
    socialPlatforms: [String],
    raidRequirements: String,
    // For dare tasks
    dareCategories: [String],
    // For wheel tasks
    wheelOutcomes: [{
      outcome: String,
      probability: Number,
      reward: {
        type: { type: String, enum: ['xp', 'tokens', 'redemption', 'none'] },
        amount: Number
      }
    }]
  },
  cooldown: { type: Number, default: 0 }, // Hours before task can be repeated
  maxCompletions: { type: Number, default: -1 }, // -1 = unlimited
  completionCount: { type: Number, default: 0 },
  createdBy: { type: String }, // User ID of admin who created it
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Optional expiration date
  tags: [{ type: String }] // For categorization
});

// Indexes
taskSchema.index({ taskId: 1 });
taskSchema.index({ type: 1, active: 1 });
taskSchema.index({ active: 1, createdAt: -1 });
taskSchema.index({ 'requirements.roleRestriction': 1, active: 1 });

// Virtual for availability
taskSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  if (!this.active) return false;
  if (this.expiresAt && this.expiresAt < now) return false;
  if (this.maxCompletions > 0 && this.completionCount >= this.maxCompletions) return false;
  return true;
});

// Methods
taskSchema.methods.canBeCompletedBy = function(user) {
  if (!this.isAvailable) return false;
  if (user.currentRole !== this.requirements.roleRestriction) return false;
  if (user.survivalCount < this.requirements.minSurvivalCount) return false;
  if (user.totalXP < this.requirements.minXP) return false;
  return true;
};

taskSchema.methods.complete = function() {
  this.completionCount += 1;
  return this.save();
};

taskSchema.methods.getRandomQuestion = function() {
  if (this.type !== 'quiz' || !this.completionData.questions.length) return null;
  const randomIndex = Math.floor(Math.random() * this.completionData.questions.length);
  return this.completionData.questions[randomIndex];
};

taskSchema.methods.getRandomDare = function() {
  if (this.type !== 'dare' || !this.completionData.dareCategories.length) return null;
  const randomIndex = Math.floor(Math.random() * this.completionData.dareCategories.length);
  return this.completionData.dareCategories[randomIndex];
};

taskSchema.methods.spinWheel = function() {
  if (this.type !== 'wheel' || !this.completionData.wheelOutcomes.length) return null;
  
  const totalProbability = this.completionData.wheelOutcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  const random = Math.random() * totalProbability;
  
  let currentProbability = 0;
  for (const outcome of this.completionData.wheelOutcomes) {
    currentProbability += outcome.probability;
    if (random <= currentProbability) {
      return outcome;
    }
  }
  
  return this.completionData.wheelOutcomes[0]; // Fallback
};

// Static methods
taskSchema.statics.getAvailableTasks = function(user) {
  return this.find({ active: true }).then(tasks => {
    return tasks.filter(task => task.canBeCompletedBy(user));
  });
};

taskSchema.statics.getTasksByType = function(type, user = null) {
  const query = { type, active: true };
  return this.find(query).then(tasks => {
    if (user) {
      return tasks.filter(task => task.canBeCompletedBy(user));
    }
    return tasks;
  });
};

module.exports = mongoose.model('Task', taskSchema);
