// app.js
App({
  onLaunch: function () {
    // 初始化全局配置
    this.globalData = {
      userInfo: null,
      role: '', // 'student' 或 'parent'
      studentId: '',
      parentId: '',
      apiBaseUrl: 'https://api.math-practice.com', // 替换为实际的API地址
      currentTask: null,
      // API配置
      apiConfig: {
        baseUrl: 'https://d.takin.shulie.io',
        apiKey: 'app-eyOgiYZWgmlt0tm0jyT4BiDz'
      }
    }
    
    // 检查用户登录状态
    const userId = wx.getStorageSync('userId')
    if (!userId) {
      // 生成临时用户ID
      const tempUserId = 'user_' + Date.now()
      wx.setStorageSync('userId', tempUserId)
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        console.log('登录成功:', res)
      }
    })
  },
  
  // 获取API配置
  getApiConfig: function() {
    return this.globalData.apiConfig
  },

  globalData: {
    userInfo: null,
    role: '', // 'student' 或 'parent'
    studentId: '',
    parentId: '',
    apiBaseUrl: 'https://api.math-practice.com', // 替换为实际的API地址
    currentTask: null
  }
}) 

