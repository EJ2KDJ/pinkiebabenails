'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Inquiry extends Model {
    static associate(models) {
      // This model has no related tables; add associations here if that changes.
    }
  }

  // Defines the fields Sequelize persists for a customer's inquiry.
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
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      service: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      preferredDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      nailDesignReference: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      gelProductRemovalNeeded: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Inquiry',
    }
  );

  return Inquiry;
};