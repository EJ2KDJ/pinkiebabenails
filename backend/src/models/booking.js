'use strict';

const { Model } = require('sequelize');

const SERVICES = [
  'Soft gel extensions',
  'Gel manicure',
  'Manicure',
  'Pedicure',
  'Other',
];

module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    static associate(models) {
      Booking.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }

  Booking.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      service: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [SERVICES],
        },
      },
      startsAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endsAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      nailDesignReference: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      gelProductRemovalNeeded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        validate: {
          isIn: [['pending', 'accepted', 'declined']],
        },
      },
    },
    {
      sequelize,
      modelName: 'Booking',
    }
  );

  return Booking;
};
