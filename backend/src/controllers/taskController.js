const Project = require('../models/Project');
const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const { getAccessibleProject } = require('./projectController');

const getAccessibleTask = async (taskId, user) => {
  const task = await Task.findById(taskId);

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  await getAccessibleProject(task.project, user);
  return task;
};

const listTasks = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userEmail = String(req.user.email || '').toLowerCase();

    const projectQuery = {
      $or: [{ owner: userId }, { 'members.user': userId }, { 'members.email': userEmail }]
    };

    if (req.query.projectId) {
      const project = await getAccessibleProject(req.query.projectId, req.user);
      projectQuery._id = project._id;
    }

    const projects = await Project.find(projectQuery).select('_id');
    const projectIds = projects.map((project) => project._id);

    const tasks = await Task.find({ project: { $in: projectIds } })
      .populate('project', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    return next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const projectId = req.body.projectId || req.body.project;

    if (!title || !projectId) {
      throw new AppError('Task title and project id are required', 400);
    }

    const project = await getAccessibleProject(projectId, req.user);

    const task = await Task.create({
      title,
      description: String(req.body.description || '').trim(),
      project: project._id,
      createdBy: req.user._id,
      assignedTo: req.body.assignedTo || null,
      status: req.body.status || 'todo',
      priority: req.body.priority || 'medium',
      dueDate: req.body.dueDate || null
    });

    await task.populate('project', 'name');

    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    return next(error);
  }
};

const getTask = async (req, res, next) => {
  try {
    const task = await getAccessibleTask(req.params.taskId, req.user);

    await task.populate([
      { path: 'project', select: 'name' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return res.json({
      success: true,
      task
    });
  } catch (error) {
    return next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await getAccessibleTask(req.params.taskId, req.user);
    const updates = ['title', 'description', 'assignedTo', 'status', 'priority', 'dueDate'];

    updates.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    await task.save();
    await task.populate([
      { path: 'project', select: 'name' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    return res.json({
      success: true,
      task
    });
  } catch (error) {
    return next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await getAccessibleTask(req.params.taskId, req.user);

    await task.deleteOne();

    return res.json({
      success: true,
      message: 'Task deleted'
    });
  } catch (error) {
    return next(error);
  }
};

const addTaskComment = async (req, res, next) => {
  try {
    const task = await getAccessibleTask(req.params.taskId, req.user);
    const body = String(req.body.body || '').trim();

    if (!body) {
      throw new AppError('Comment body is required', 400);
    }

    task.comments.push({
      author: req.user._id,
      authorName: req.user.name,
      body
    });

    await task.save();
    await task.populate([
      { path: 'project', select: 'name' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addTaskComment,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask
};
