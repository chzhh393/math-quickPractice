const app = getApp()
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    tasks: [],
    loading: true
  },

  onLoad: function() {
    this.loadTasks()
  },

  onShow: function() {
    // 每次显示页面时重新加载任务，确保数据最新
    this.loadTasks()
  },

  loadTasks: function() {
    this.setData({ loading: true })
    
    // 从本地存储获取任务
    const storedTasks = wx.getStorageSync('mathTasks') || []
    
    if (storedTasks.length > 0) {
      this.setData({
        tasks: storedTasks,
        loading: false
      })
    } else {
      // 如果没有本地任务，加载模拟数据
      const mockTasks = [
        { id: 1, title: '基础数学练习', date: '2023-03-01', status: '进行中' },
        { id: 2, title: '几何问题集', date: '2023-03-05', status: '未开始' },
        { id: 3, title: '代数练习', date: '2023-02-28', status: '已完成' }
      ]
      
      this.setData({
        tasks: mockTasks,
        loading: false
      })
    }
  },

  // 查看任务详情
  viewTaskDetail: function(e) {
    const taskId = e.currentTarget.dataset.id
    
    // 跳转到问题解决页面
    wx.navigateTo({
      url: `../problemSolving/index?taskId=${taskId}`
    })
  },

  // 创建新任务
  createNewTask: function() {
    wx.navigateTo({
      url: '../problemCapture/index'
    })
  },

  // 加载任务详情
  loadTaskDetail: function (taskId) {
    this.setData({ loading: true })
    
    api.getTaskDetail(taskId).then(res => {
      // 保存任务信息到全局数据
      app.globalData.currentTask = res.task
      
      this.setData({
        task: res.task,
        problems: res.problems || [],
        loading: false
      })
    }).catch(err => {
      console.error('获取任务详情失败', err)
      this.setData({ loading: false })
      util.showToast('获取任务详情失败')
    })
  },

  // 开始解题
  startSolving: function (e) {
    const problemId = e.currentTarget.dataset.id
    
    if (!problemId) {
      util.showToast('题目ID不存在')
      return
    }
    
    wx.navigateTo({
      url: `/pages/student/problemSolving/index?taskId=${this.data.taskId}&problemId=${problemId}`
    })
  },

  // 完成任务
  completeTask: function () {
    if (this.data.task.status === 'completed') {
      util.showToast('任务已完成')
      return
    }
    
    // 检查是否所有题目都已完成
    const allCompleted = this.data.problems.every(p => p.status === 'completed')
    
    if (!allCompleted) {
      util.showModal('提示', '还有题目未完成，确定要结束任务吗？').then(res => {
        if (res) {
          this.submitCompleteTask()
        }
      })
    } else {
      this.submitCompleteTask()
    }
  },

  // 提交完成任务
  submitCompleteTask: function () {
    util.showToast('正在提交...', 'loading')
    
    api.completeTask(this.data.taskId).then(res => {
      util.showToast('任务已完成', 'success')
      
      // 刷新任务详情
      this.loadTaskDetail(this.data.taskId)
    }).catch(err => {
      console.error('完成任务失败', err)
      util.showToast('完成任务失败')
    })
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    if (this.data.taskId) {
      this.loadTaskDetail(this.data.taskId)
    }
    wx.stopPullDownRefresh()
  }
}) 

