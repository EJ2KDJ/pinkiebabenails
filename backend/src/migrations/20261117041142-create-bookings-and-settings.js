'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Bookings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      service: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      startsAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      nailDesignReference: {
        allowNull: true,
        type: Sequelize.STRING(1000),
      },
      gelProductRemovalNeeded: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
      },
      status: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'pending',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE "Bookings"
      ADD CONSTRAINT "bookings_status_valid"
      CHECK ("status" IN ('pending', 'accepted', 'declined'))
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Bookings"
      ADD CONSTRAINT "bookings_service_valid"
      CHECK ("service" IN (
        'Soft gel extensions', 'Gel manicure', 'Manicure', 'Pedicure', 'Other'
      ))
    `);

    // Pending requests remain available; only accepted bookings reserve a time.
    await queryInterface.addIndex('Bookings', ['startsAt'], {
      name: 'bookings_accepted_starts_at_unique',
      unique: true,
      where: { status: 'accepted' },
    });

    await queryInterface.createTable('Settings', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      openHour: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 10,
      },
      closeHour: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 18,
      },
      daysOff: {
        allowNull: false,
        type: Sequelize.ARRAY(Sequelize.DATEONLY),
        defaultValue: Sequelize.literal('ARRAY[]::DATE[]'),
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Constrain the settings table to its single supported row and valid hours.
    await queryInterface.sequelize.query(`
      ALTER TABLE "Settings"
      ADD CONSTRAINT "settings_single_row" CHECK ("id" = 1)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Settings"
      ADD CONSTRAINT "settings_valid_hours"
      CHECK ("openHour" >= 0 AND "openHour" < "closeHour" AND "closeHour" <= 24)
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO "Settings" ("id", "openHour", "closeHour", "daysOff", "createdAt", "updatedAt")
      VALUES (1, 10, 18, ARRAY[]::DATE[], NOW(), NOW())
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Settings');
    await queryInterface.dropTable('Bookings');
  },
};
