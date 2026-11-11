'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Inquiry extends Model {
    static associate(models) {
      // This model has no related tables; add associations here if that changes.
    }
  }

  // Defines the fields Sequelize persists for a customer's appointment inquiry.
  Inquiry.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      service: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      preferredDateTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      nailDesignReference: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      gelProductRemovalNeeded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Inquiry',
    }
  );

  return Inquiry;
};