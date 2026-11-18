'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'resetPasswordTokenHash', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'resetPasswordExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'resetPasswordExpiresAt');
    await queryInterface.removeColumn('Users', 'resetPasswordTokenHash');
  },
};
