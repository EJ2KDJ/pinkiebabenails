'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Inquiries', 'message', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn('Inquiries', 'phoneNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('Inquiries', 'service', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('Inquiries', 'preferredDateTime', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.changeColumn('Inquiries', 'gelProductRemovalNeeded', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Inquiries', 'phoneNumber', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('Inquiries', 'service', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('Inquiries', 'preferredDateTime', {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn('Inquiries', 'gelProductRemovalNeeded', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
    });
    await queryInterface.removeColumn('Inquiries', 'message');
  },
};
