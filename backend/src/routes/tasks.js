const express = require('express');
const {
  addTaskComment,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(listTasks).post(createTask);
router.route('/:taskId').get(getTask).patch(updateTask).delete(deleteTask);
router.post('/:taskId/comments', addTaskComment);

module.exports = router;
