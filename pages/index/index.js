const app = getApp()

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile')
  },

  onLoad: function () {
    // 检查是否已有用户信息
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    }
  },

  // 获取用户信息
  getUserProfile: function () {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        app.globalData.userInfo = res.userInfo
        wx.setStorageSync('userInfo', res.userInfo)
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },

  // 选择角色：学生
  chooseStudent: function () {
    app.globalData.role = 'student'
    wx.setStorageSync('role', 'student')
    wx.switchTab({
      url: '/pages/student/index/index'
    })
  },

  // 选择角色：家长
  chooseParent: function () {
    app.globalData.role = 'parent'
    wx.setStorageSync('role', 'parent')
    wx.switchTab({
      url: '/pages/parent/index/index'
    })
  }
}) 

