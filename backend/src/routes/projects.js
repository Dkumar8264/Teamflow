const express = require('express');
const {
  addProjectMember,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  removeProjectMember,
  updateProject
} = require('../controllers/projectController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(listProjects).post(createProject);
router.route('/:projectId').get(getProject).patch(updateProject).delete(deleteProject);
router.post('/:projectId/members', addProjectMember);
router.delete('/:projectId/members/:memberId', removeProjectMember);

module.exports = router;
