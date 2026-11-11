'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the initial table for contact details and requested nail services.
    await queryInterface.createTable('Inquiries', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      phoneNumber: {
        type: Sequelize.STRING
      },
      service: {
        type: Sequelize.STRING
      },
      nailDesignReference: {
        type: Sequelize.TEXT
      },
      gelProductRemovalNeeded: {
        type: Sequelize.BOOLEAN
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    // Reverse the initial migration when rolling back the schema.
    await queryInterface.dropTable('Inquiries');
  }
};