'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Settings extends Model {}

  Settings.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        defaultValue: 1,
      },
      openHour: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
        validate: {
          min: 0,
          max: 23,
        },
      },
      closeHour: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
        validate: {
          min: 1,
          max: 24,
          isAfterOpenHour(value) {
            if (value <= this.openHour) {
              throw new Error('Closing hour must be after opening hour.');
            }
          },
        },
      },
      daysOff: {
        type: DataTypes.ARRAY(DataTypes.DATEONLY),
        allowNull: false,
        defaultValue: [],
      },
      customSlotsByDate: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'Settings',
    }
  );

  return Settings;
};
