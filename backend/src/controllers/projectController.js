const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const canAccessProject = (project, user) => {
  const userId = user._id.toString();
  const userEmail = normalizeEmail(user.email);

  return (
    project.owner.toString() === userId ||
    project.members.some((member) => member.user?.toString() === userId || normalizeEmail(member.email) === userEmail)
  );
};

const canManageProject = (project, user) => project.owner.toString() === user._id.toString();

const getAccessibleProject = async (projectId, user, { requireOwner = false } = {}) => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (requireOwner ? !canManageProject(project, user) : !canAccessProject(project, user)) {
    throw new AppError('You do not have access to this project', 403);
  }

  return project;
};

const listProjects = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userEmail = normalizeEmail(req.user.email);

    const projects = await Project.find({
      $or: [{ owner: userId }, { 'members.user': userId }, { 'members.email': userEmail }]
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      projects
    });
  } catch (error) {
    return next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const color = String(req.body.color || '#0038ff').trim();

    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    const project = await Project.create({
      name,
      description,
      color,
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: 'owner'
        }
      ]
    });

    return res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    return next(error);
  }
};

const getProject = async (req, res, next) => {
  try {
    const project = await getAccessibleProject(req.params.projectId, req.user);
    const tasks = await Task.find({ project: project._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      project,
      tasks
    });
  } catch (error) {
    return next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await getAccessibleProject(req.params.projectId, req.user, { requireOwner: true });
    const updates = ['name', 'description', 'status', 'color'];

    updates.forEach((field) => {
      if (req.body[field] !== undefined) {
        project[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    await project.save();

    return res.json({
      success: true,
      project
    });
  } catch (error) {
    return next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await getAccessibleProject(req.params.projectId, req.user, { requireOwner: true });

    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    return res.json({
      success: true,
      message: 'Project deleted'
    });
  } catch (error) {
    return next(error);
  }
};

const addProjectMember = async (req, res, next) => {
  try {
    const project = await getAccessibleProject(req.params.projectId, req.user, { requireOwner: true });
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const role = req.body.role || 'member';

    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new AppError('Member name and valid email are required', 400);
    }

    if (project.members.some((member) => normalizeEmail(member.email) === email)) {
      throw new AppError('Member already exists in project', 409);
    }

    const user = await User.findOne({ email }).select('_id name email');

    project.members.push({
      user: user?._id || null,
      name: user?.name || name,
      email,
      role
    });
    await project.save();

    return res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    return next(error);
  }
};

const removeProjectMember = async (req, res, next) => {
  try {
    const project = await getAccessibleProject(req.params.projectId, req.user, { requireOwner: true });
    const member = project.members.id(req.params.memberId);

    if (!member) {
      throw new AppError('Project member not found', 404);
    }

    if (member.role === 'owner') {
      throw new AppError('Project owner cannot be removed', 400);
    }

    member.deleteOne();
    await project.save();

    return res.json({
      success: true,
      project
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addProjectMember,
  createProject,
  deleteProject,
  getAccessibleProject,
  getProject,
  listProjects,
  removeProjectMember,
  updateProject
};
