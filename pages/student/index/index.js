Page({
  data: {
    userName: '',
    tasks: [],
    loading: true
  },

  onLoad: function() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userName: userInfo.name || '同学'
      })
    }
    
    // 加载任务列表
    this.loadTasks()
  },
  
  onShow: function() {
    // 每次页面显示时重新加载任务，确保数据最新
    this.loadTasks()
  },
  
  // 加载任务列表
  loadTasks: function() {
    this.setData({ loading: true })
    
    // 从本地存储获取任务列表
    const tasks = wx.getStorageSync('mathTasks') || []
    
    // 按创建时间排序，最新的在前面
    const sortedTasks = tasks.sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
    
    this.setData({
      tasks: sortedTasks,
      loading: false
    })
  },
  
  // 导航到拍照解题页面
  navigateToPhotoSolve: function() {
    wx.navigateTo({
      url: '/pages/student/photoSolve/index'
    })
  },
  
  // 导航到任务详情页面
  navigateToTask: function(e) {
    const taskId = e.currentTarget.dataset.taskId
    wx.navigateTo({
      url: `/pages/student/problemSolving/index?taskId=${taskId}`
    })
  }
}) 

