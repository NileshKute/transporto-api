const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sgId: {
    type: DataTypes.INTEGER,
    unique: true,
    comment: 'ShotGrid People ID'
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING
  },
  firstName: {
    type: DataTypes.STRING
  },
  lastName: {
    type: DataTypes.STRING
  },
  department: {
    type: DataTypes.STRING
  },
  designation: {
    type: DataTypes.STRING,
    comment: 'Role: CCO, Floor Supervisor, Dept Supervisor, Associate Supe, Team Lead, Associate TL, Artist'
  },
  hierarchyLevel: {
    type: DataTypes.INTEGER,
    comment: '1=CCO, 2=FloorSupe, 3=DeptSupe, 4=AssocSupe, 5=TL, 6=AssocTL, 7=Artist'
  },
  reportingToId: {
    type: DataTypes.INTEGER,
    comment: 'User ID of direct supervisor'
  },
  appRole: {
    type: DataTypes.ENUM('super_admin', 'hr', 'cco', 'supervisor', 'team_lead', 'associate_tl', 'artist', 'line_producer', 'prod_coordinator'),
    defaultValue: 'artist'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastSyncedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  timestamps: true
});

// Department Model
const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  sgId: {
    type: DataTypes.INTEGER,
    comment: 'ShotGrid Department ID'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'departments',
  timestamps: true
});

// Feedback Model
const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  artistId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID of the artist receiving feedback'
  },
  submittedById: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'User ID of team lead giving feedback'
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '1-12'
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  workingPercentage: {
    type: DataTypes.FLOAT,
    comment: 'Overall performance percentage 0-100'
  },
  qualityRating: {
    type: DataTypes.INTEGER,
    comment: 'Rating 1-5'
  },
  speedRating: {
    type: DataTypes.INTEGER,
    comment: 'Rating 1-5'
  },
  communicationRating: {
    type: DataTypes.INTEGER,
    comment: 'Rating 1-5'
  },
  initiativeRating: {
    type: DataTypes.INTEGER,
    comment: 'Rating 1-5'
  },
  comment: {
    type: DataTypes.TEXT
  },
  supervisorComment: {
    type: DataTypes.TEXT,
    comment: 'Optional comment from supervisor reviewing TL feedback'
  },
  supervisorId: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'locked'),
    defaultValue: 'draft'
  },
  submittedAt: {
    type: DataTypes.DATE
  },
  lockedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'feedbacks',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['artistId', 'submittedById', 'month', 'year'],
      name: 'unique_feedback_per_month'
    }
  ]
});

// Attendance Summary Model (synced from ShotGrid)
const AttendanceSummary = sequelize.define('AttendanceSummary', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  totalWorkingDays: {
    type: DataTypes.INTEGER
  },
  daysPresent: {
    type: DataTypes.INTEGER
  },
  daysAbsent: {
    type: DataTypes.INTEGER
  },
  totalHoursWorked: {
    type: DataTypes.FLOAT
  },
  avgHoursPerDay: {
    type: DataTypes.FLOAT
  },
  lastSyncedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'attendance_summary',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'month', 'year']
    }
  ]
});

// Audit Log
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER
  },
  action: {
    type: DataTypes.STRING,
    comment: 'e.g., feedback_submitted, feedback_edited, user_synced'
  },
  details: {
    type: DataTypes.JSONB
  },
  ipAddress: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'audit_logs',
  timestamps: true
});

// ============ RELATIONSHIPS ============

// User relationships
User.belongsTo(User, { as: 'reportingTo', foreignKey: 'reportingToId' });
User.hasMany(User, { as: 'teamMembers', foreignKey: 'reportingToId' });

// Feedback relationships
Feedback.belongsTo(User, { as: 'artist', foreignKey: 'artistId' });
Feedback.belongsTo(User, { as: 'submittedBy', foreignKey: 'submittedById' });
Feedback.belongsTo(User, { as: 'supervisor', foreignKey: 'supervisorId' });
User.hasMany(Feedback, { as: 'receivedFeedbacks', foreignKey: 'artistId' });
User.hasMany(Feedback, { as: 'givenFeedbacks', foreignKey: 'submittedById' });

// Attendance relationships
AttendanceSummary.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(AttendanceSummary, { foreignKey: 'userId' });

// Audit relationships
AuditLog.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Department,
  Feedback,
  AttendanceSummary,
  AuditLog
};