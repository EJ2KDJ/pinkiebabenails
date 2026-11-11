'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Store the customer's requested appointment date and time with each inquiry.
    await queryInterface.addColumn('Inquiries', 'preferredDateTime', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

    // Remove the added field when rolling this migration back.
    await queryInterface.removeColumn('Inquiries', 'preferredDateTime');
  },
};