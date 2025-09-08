require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

// Discord Client Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Configuration
const KICK_TIMER_HOURS = parseFloat(process.env.KICK_TIMER_HOURS || '24');
const KICK_TIMER_MS = KICK_TIMER_HOURS * 60 * 60 * 1000;
const REMINDER_INTERVALS = (process.env.REMINDER_INTERVALS || '8,4,1').split(',').map(h => parseInt(h) * 60 * 60 * 1000);
const DEFAULT_XP_REWARD = parseInt(process.env.DEFAULT_XP_REWARD || '100');
const DEFAULT_TOKEN_REWARD = parseInt(process.env.DEFAULT_TOKEN_REWARD || '50');

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  joinTime: { type: Date, default: Date.now },
  kickTime: { type: Date },
  currentRole: { type: String, default: 'normal' },
  survivalCount: { type: Number, default: 0 },
  totalXP: { type: Number, default: 0 },
  tokens: { type: Number, default: 100 },
  lastTaskCompletion: { type: Date },
  kickMessages: [{ type: String }],
  remindersSent: [{ type: Number }]
});

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true },
  type: { type: String, enum: ['quiz', 'meme', 'raid', 'wheel', 'dare'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  rewardXP: { type: Number, default: DEFAULT_XP_REWARD },
  rewardTokens: { type: Number, default: DEFAULT_TOKEN_REWARD },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const leaderboardSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  type: { type: String, enum: ['survivors', 'xp', 'longest_streak'], required: true },
  entries: [{
    userId: String,
    value: Number,
    rank: Number
  }],
  lastUpdated: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

// Kick Messages
const kickMessages = [
  "🌪️ {user} has been sucked into the Shadow Realm!",
  "🚀 {user} is now in cryosleep for the next 24 hours!",
  "⚡ {user} got zapped by the moderation lightning!",
  "🎭 {user} is now starring in 'The Kicked Chronicles'!",
  "🔮 {user} has been banished to the void!",
  "🌊 {user} got swept away by the moderation tsunami!",
  "🔥 {user} has been consumed by the admin fire!",
  "❄️ {user} is now frozen in digital ice!"
];

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Bot Ready
client.on('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  
  // Register slash commands
  await registerCommands();
  
  // Start monitoring
  setInterval(checkForKicks, 60 * 1000); // Check every minute
  setInterval(checkForReminders, 5 * 60 * 1000); // Check every 5 minutes
  
  console.log('🎮 Gamified Kick & Survival Bot is ready!');
});

// Handle New Members
client.on('guildMemberAdd', async member => {
  try {
    await handleNewMember(member);
  } catch (err) {
    console.error('❌ guildMemberAdd error:', err.message);
  }
});

// Handle New Member
async function handleNewMember(member) {
  try {
    // Create or update user record
    await User.findOneAndUpdate(
      { userId: member.id, guildId: member.guild.id },
      {
        joinTime: new Date(),
        currentRole: 'normal',
        remindersSent: []
      },
      { upsert: true, new: true }
    );

    // Send welcome message
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎮 Welcome to the Survival Game!')
      .setDescription(`You have **${KICK_TIMER_HOURS} hours** to prove your worth!\n\nUse \`/survive\` to check your status anytime.`)
      .setFooter({ text: 'Good luck, survivor!' });

    await member.send({ embeds: [welcomeEmbed] });
    console.log(`👋 Welcome message sent to ${member.user.tag}`);

  } catch (err) {
    console.error(`❌ Failed to handle new member ${member.user.tag}:`, err.message);
  }
}

// Check for kicks
async function checkForKicks() {
  try {
    const now = new Date();
    const usersToKick = await User.find({
      currentRole: 'normal',
      joinTime: { $lte: new Date(now.getTime() - KICK_TIMER_MS) }
    });

    for (const user of usersToKick) {
      try {
        const guild = await client.guilds.fetch(user.guildId);
        const member = await guild.members.fetch(user.userId).catch(() => null);
        
        if (member) {
          await handleKick(member, user);
        }
      } catch (err) {
        console.error(`❌ Error processing kick for user ${user.userId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ checkForKicks error:', err.message);
  }
}

// Handle kick
async function handleKick(member, userRecord) {
  try {
    const guild = member.guild;
    
    // Get kicked role
    const kickedRole = guild.roles.cache.find(role => role.name === 'Kicked');
    if (!kickedRole) {
      console.error('❌ Kicked role not found');
      return;
    }

    // Assign kicked role
    await member.roles.add(kickedRole);
    
    // Update user record
    await User.findOneAndUpdate(
      { userId: member.id, guildId: guild.id },
      {
        currentRole: 'kicked',
        kickTime: new Date(),
        survivalCount: userRecord.survivalCount + 1
      }
    );

    // Send kick announcement
    const randomMessage = kickMessages[Math.floor(Math.random() * kickMessages.length)]
      .replace('{user}', member.user.toString());
    
    const kickEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚡ KICK EVENT ⚡')
      .setDescription(randomMessage)
      .addFields(
        { name: 'Survival Count', value: `${userRecord.survivalCount + 1}`, inline: true },
        { name: 'Status', value: '🔴 KICKED', inline: true }
      )
      .setFooter({ text: 'Complete tasks to regain access!' });

    const announcementChannel = guild.channels.cache.get(process.env.ANNOUNCEMENT_CHANNEL_ID);
    if (announcementChannel) {
      await announcementChannel.send({ embeds: [kickEmbed] });
    }

    // Send DM to kicked user
    const dmEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('🚨 You\'ve Been Kicked!')
      .setDescription('Don\'t worry! You can regain access by completing survival tasks.\n\nUse `/tasks` to see available challenges!')
      .setFooter({ text: 'Good luck, survivor!' });

    try {
      await member.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`⚠️ Could not send DM to ${member.user.tag}`);
    }

    console.log(`👢 Kicked ${member.user.tag} (Survival #${userRecord.survivalCount + 1})`);

  } catch (err) {
    console.error(`❌ Failed to kick ${member.user.tag}:`, err.message);
  }
}

// Check for reminders
async function checkForReminders() {
  try {
    const now = new Date();
    
    for (const interval of REMINDER_INTERVALS) {
      const reminderTime = new Date(now.getTime() - interval);
      const usersToRemind = await User.find({
        currentRole: 'normal',
        joinTime: { $lte: reminderTime },
        remindersSent: { $nin: [interval] }
      });

      for (const user of usersToRemind) {
        try {
          const guild = await client.guilds.fetch(user.guildId);
          const member = await guild.members.fetch(user.userId).catch(() => null);
          
          if (member) {
            await sendReminder(member, interval);
            
            // Mark reminder as sent
            await User.findOneAndUpdate(
              { userId: user.userId, guildId: user.guildId },
              { $push: { remindersSent: interval } }
            );
          }
        } catch (err) {
          console.error(`❌ Error sending reminder to user ${user.userId}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ checkForReminders error:', err.message);
  }
}

// Send reminder
async function sendReminder(member, interval) {
  try {
    const hoursLeft = Math.floor(interval / (60 * 60 * 1000));
    
    const reminderEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏰ Survival Countdown')
      .setDescription(`You'll be kicked in **${hoursLeft} hours**. Any last words?`)
      .setFooter({ text: 'Complete tasks to extend your survival!' });

    try {
      await member.send({ embeds: [reminderEmbed] });
      console.log(`📢 Reminder sent to ${member.user.tag} (${hoursLeft}h left)`);
    } catch (dmError) {
      console.log(`⚠️ Could not send reminder DM to ${member.user.tag}`);
    }
  } catch (err) {
    console.error(`❌ Failed to send reminder to ${member.user.tag}:`, err.message);
  }
}

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('survive')
      .setDescription('Check your survival status and time remaining'),
    
    new SlashCommandBuilder()
      .setName('tasks')
      .setDescription('View available survival tasks'),
    
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Display current survivor leaderboard'),
    
    new SlashCommandBuilder()
      .setName('bribe')
      .setDescription('Spend tokens for survival extensions')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of tokens to spend')
          .setRequired(true)
          .setMinValue(1)
      ),
    
    new SlashCommandBuilder()
      .setName('wheel')
      .setDescription('Spin the Wheel of Fate for a chance at redemption'),
    
    new SlashCommandBuilder()
      .setName('vote')
      .setDescription('Vote to save or doom a player')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to vote for')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Vote action')
          .setRequired(true)
          .addChoices(
            { name: 'Save', value: 'save' },
            { name: 'Doom', value: 'doom' }
          )
      )
  ];

  // Admin commands
  const adminCommands = [
    new SlashCommandBuilder()
      .setName('admin-add-task')
      .setDescription('Add a new survival task')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Task type')
          .setRequired(true)
          .addChoices(
            { name: 'Quiz', value: 'quiz' },
            { name: 'Meme', value: 'meme' },
            { name: 'Raid', value: 'raid' },
            { name: 'Wheel', value: 'wheel' },
            { name: 'Dare', value: 'dare' }
          )
      )
      .addStringOption(option =>
        option.setName('title')
          .setDescription('Task title')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Task description')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('admin-reset-user')
      .setDescription('Reset a user\'s survival status')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to reset')
          .setRequired(true)
      )
  ];

  const allCommands = [...commands, ...adminCommands];
  
  try {
    await client.application.commands.set(allCommands);
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('❌ Failed to register commands:', err.message);
  }
}

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'survive':
        await handleSurviveCommand(interaction);
        break;
      case 'tasks':
        await handleTasksCommand(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboardCommand(interaction);
        break;
      case 'bribe':
        await handleBribeCommand(interaction);
        break;
      case 'wheel':
        await handleWheelCommand(interaction);
        break;
      case 'vote':
        await handleVoteCommand(interaction);
        break;
      case 'admin-add-task':
        await handleAdminAddTaskCommand(interaction);
        break;
      case 'admin-reset-user':
        await handleAdminResetUserCommand(interaction);
        break;
    }
  } catch (err) {
    console.error(`❌ Command error:`, err.message);
    await interaction.reply({ content: '❌ An error occurred while processing your command.', ephemeral: true });
  }
});

// Command handlers
async function handleSurviveCommand(interaction) {
  const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
  
  if (!user) {
    await interaction.reply({ content: '❌ User not found in survival system.', ephemeral: true });
    return;
  }

  const now = new Date();
  const timeSinceJoin = now.getTime() - user.joinTime.getTime();
  const timeRemaining = KICK_TIMER_MS - timeSinceJoin;
  
  let status = '🟢 SAFE';
  let description = `You have **${Math.floor(timeRemaining / (60 * 60 * 1000))} hours** remaining.`;
  
  if (user.currentRole === 'kicked') {
    status = '🔴 KICKED';
    description = 'Complete tasks to regain access!';
  } else if (timeRemaining <= 0) {
    status = '⚡ READY TO KICK';
    description = 'Your time is up!';
  }

  const embed = new EmbedBuilder()
    .setColor(user.currentRole === 'kicked' ? '#FF0000' : '#00FF00')
    .setTitle('🎮 Survival Status')
    .addFields(
      { name: 'Status', value: status, inline: true },
      { name: 'Survival Count', value: `${user.survivalCount}`, inline: true },
      { name: 'Total XP', value: `${user.totalXP}`, inline: true },
      { name: 'Tokens', value: `${user.tokens}`, inline: true },
      { name: 'Time Info', value: description, inline: false }
    )
    .setFooter({ text: 'Use /tasks to see available challenges!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleTasksCommand(interaction) {
  const tasks = await Task.find({ active: true });
  
  if (tasks.length === 0) {
    await interaction.reply({ content: '❌ No tasks available at the moment.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('🎯 Available Survival Tasks')
    .setDescription('Complete these tasks to regain access or earn rewards!');

  tasks.forEach((task, index) => {
    embed.addFields({
      name: `${index + 1}. ${task.title}`,
      value: `${task.description}\n**Reward:** ${task.rewardXP} XP + ${task.rewardTokens} tokens`,
      inline: false
    });
  });

  embed.setFooter({ text: 'Contact admins to complete tasks!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboardCommand(interaction) {
  const users = await User.find({ guildId: interaction.guild.id })
    .sort({ survivalCount: -1, totalXP: -1 })
    .limit(10);

  if (users.length === 0) {
    await interaction.reply({ content: '❌ No survivors found.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Survivor Leaderboard')
    .setDescription('Top survivors in the server!');

  users.forEach((user, index) => {
    const member = interaction.guild.members.cache.get(user.userId);
    const username = member ? member.user.username : 'Unknown User';
    
    embed.addFields({
      name: `#${index + 1} ${username}`,
      value: `Survivals: ${user.survivalCount} | XP: ${user.totalXP} | Tokens: ${user.tokens}`,
      inline: false
    });
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleBribeCommand(interaction) {
  const amount = interaction.options.getInteger('amount');
  const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
  
  if (!user) {
    await interaction.reply({ content: '❌ User not found in survival system.', ephemeral: true });
    return;
  }

  if (user.tokens < amount) {
    await interaction.reply({ content: `❌ You don't have enough tokens. You have ${user.tokens} tokens.`, ephemeral: true });
    return;
  }

  // Extend survival time
  const extensionHours = Math.floor(amount / 10); // 10 tokens = 1 hour
  const newJoinTime = new Date(user.joinTime.getTime() - (extensionHours * 60 * 60 * 1000));
  
  await User.findOneAndUpdate(
    { userId: interaction.user.id, guildId: interaction.guild.id },
    {
      tokens: user.tokens - amount,
      joinTime: newJoinTime,
      remindersSent: [] // Reset reminders
    }
  );

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('💰 Bribe Successful!')
    .setDescription(`You've extended your survival by **${extensionHours} hours**!\n\nTokens spent: ${amount}\nRemaining tokens: ${user.tokens - amount}`)
    .setFooter({ text: 'Survival extended!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleWheelCommand(interaction) {
  const outcomes = [
    { text: '🎉 Instant Redemption!', reward: 'redemption' },
    { text: '💰 Bonus Tokens!', reward: 'tokens' },
    { text: '⚡ XP Boost!', reward: 'xp' },
    { text: '😈 Bad Luck!', reward: 'none' },
    { text: '🔄 Spin Again!', reward: 'spin' },
    { text: '🎁 Mystery Reward!', reward: 'mystery' }
  ];

  const result = outcomes[Math.floor(Math.random() * outcomes.length)];
  
  const embed = new EmbedBuilder()
    .setColor('#FF6B6B')
    .setTitle('🎡 Wheel of Fate')
    .setDescription(`**${result.text}**`)
    .setFooter({ text: 'Spin the wheel and hope for the best!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleVoteCommand(interaction) {
  const targetUser = interaction.options.getUser('user');
  const action = interaction.options.getString('action');
  
  const embed = new EmbedBuilder()
    .setColor(action === 'save' ? '#00FF00' : '#FF0000')
    .setTitle(`🗳️ Vote ${action === 'save' ? 'Save' : 'Doom'}`)
    .setDescription(`${interaction.user} voted to **${action}** ${targetUser}!\n\nVotes: 1`)
    .setFooter({ text: 'Community voting in progress!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleAdminAddTaskCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    return;
  }

  const type = interaction.options.getString('type');
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');

  const task = new Task({
    taskId: `task_${Date.now()}`,
    type,
    title,
    description,
    rewardXP: DEFAULT_XP_REWARD,
    rewardTokens: DEFAULT_TOKEN_REWARD
  });

  await task.save();

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Task Added')
    .setDescription(`**${title}**\n${description}\n\nType: ${type}\nReward: ${DEFAULT_XP_REWARD} XP + ${DEFAULT_TOKEN_REWARD} tokens`)
    .setFooter({ text: 'New survival task created!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleAdminResetUserCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  
  await User.findOneAndUpdate(
    { userId: targetUser.id, guildId: interaction.guild.id },
    {
      currentRole: 'normal',
      joinTime: new Date(),
      remindersSent: []
    },
    { upsert: true }
  );

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ User Reset')
    .setDescription(`${targetUser} has been reset and given a fresh start!`)
    .setFooter({ text: 'User reset successful!' });

  await interaction.reply({ embeds: [embed] });
}

// Login
client.login(process.env.DISCORD_TOKEN);