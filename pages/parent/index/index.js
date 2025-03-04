const app = getApp()

Page({
  data: {
    userInfo: null
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
  },

  onShow: function () {
    // 每次显示页面时刷新数据
  }
}) 

