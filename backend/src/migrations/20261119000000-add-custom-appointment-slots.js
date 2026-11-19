'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Settings', 'customSlotsByDate', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    await queryInterface.addColumn('Bookings', 'endsAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE "Bookings"
      SET "endsAt" = "startsAt" + INTERVAL '1 hour'
      WHERE "endsAt" IS NULL
    `);
    await queryInterface.changeColumn('Bookings', 'endsAt', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Bookings', 'endsAt');
    await queryInterface.removeColumn('Settings', 'customSlotsByDate');
  },
};
