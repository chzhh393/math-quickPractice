// app.js
import apiConfig from './config/api.js'

App({
  onLaunch: function () {
    // 初始化用户ID
    const userId = wx.getStorageSync('userId')
    if (!userId) {
      const newUserId = 'user_' + Date.now() + Math.floor(Math.random() * 1000)
      wx.setStorageSync('userId', newUserId)
      console.log('创建新用户ID:', newUserId)
    }
    
    // 合并API配置到全局数据
    this.globalData = {
      userInfo: null,
      role: '', // 'student' 或 'parent'
      studentId: '',
      parentId: '',
      apiBaseUrl: 'https://api.math-practice.com', // 替换为实际的API地址
      currentTask: null,
      // API配置
      apiConfig: apiConfig,
      BASE_URL: apiConfig.baseUrl,
      API_KEY: apiConfig.apiKey
    }
    
    console.log('应用启动，API配置:', this.globalData.BASE_URL)
  }
}) 

