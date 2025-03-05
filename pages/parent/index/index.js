const app = getApp()

Page({
  data: {
    userInfo: null,
    tasks: [],
    loading: true,
    errorMessage: ''
  },

  onLoad: function () {
    // 设置角色
    app.globalData.role = 'parent'
    
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo
      })
      app.globalData.userInfo = userInfo
    }

    // 加载任务列表
    this.loadTasks()
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    this.loadTasks()
  },

  // 加载任务列表
  loadTasks: function() {
    this.setData({ loading: true })
    
    try {
      // 从本地存储获取任务
      const tasks = wx.getStorageSync('mathTasks') || []
      console.log('原始任务数据:', tasks)
      
      // 处理任务数据，计算进度等
      const processedTasks = tasks.map(task => {
        const problems = task.problems || {}
        const problemKeys = Object.keys(problems)
        const problemCount = problemKeys.length
        
        // 计算已回答的题目数量
        let answeredCount = 0
        problemKeys.forEach(key => {
          const problem = problems[key]
          const history = problem.history || []
          if (history.length > 0) {
            answeredCount++
          }
        })
        
        // 计算进度百分比
        const progress = problemCount > 0 ? Math.round((answeredCount / problemCount) * 100) : 0
        
        return {
          ...task,
          problemCount: problemCount,
          answeredCount: answeredCount,
          progress: progress
        }
      })
      
      // 按创建时间倒序排列，最新的任务在前面
      processedTasks.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0))
      
      this.setData({
        tasks: processedTasks,
        loading: false
      })
      
      console.log('处理后的任务数据:', processedTasks)
    } catch (error) {
      console.error('加载任务列表失败:', error)
      this.setData({
        loading: false,
        errorMessage: '加载任务列表失败: ' + error.message
      })
    }
  },
  
  // 查看任务报告
  viewTaskReport: function(e) {
    const taskId = e.currentTarget.dataset.taskId
    
    wx.navigateTo({
      url: `/pages/parent/taskReport/index?taskId=${taskId}`,
      success: function() {
        console.log('成功导航到任务报告页面')
      },
      fail: function(error) {
        console.error('导航到任务报告页面失败:', error)
        wx.showToast({
          title: '打开任务报告失败',
          icon: 'none'
        })
      }
    })
  },
  
  // 格式化时间
  formatTime: function(isoString) {
    if (!isoString) return ''
    
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }
}) 

