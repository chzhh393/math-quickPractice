// API调用工具类
const app = getApp()

/**
 * 封装请求方法
 * @param {String} url - 请求地址
 * @param {String} method - 请求方法
 * @param {Object} data - 请求数据
 * @returns {Promise} - 返回Promise对象
 */
const request = (url, method, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'Authorization': wx.getStorageSync('token') || ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // token过期，需要重新登录
          wx.removeStorageSync('token')
          wx.navigateTo({
            url: '/pages/index/index'
          })
          reject(new Error('登录已过期，请重新登录'))
        } else {
          reject(new Error(res.data.message || '请求失败'))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络错误'))
      }
    })
  })
}

// 显示错误提示
const showError = (message) => {
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  })
}

/**
 * 上传文件
 * @param {String} filePath - 文件路径
 * @param {String} url - 上传地址
 * @returns {Promise} - 返回Promise对象
 */
const uploadFile = (filePath, url) => {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}${url}`,
      filePath,
      name: 'file',
      header: {
        'Authorization': wx.getStorageSync('token') || ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 文件上传成功后，服务器会返回文件ID
          const data = JSON.parse(res.data)
          resolve(data)
        } else {
          reject(new Error('文件上传失败'))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络错误'))
      }
    })
  })
}

// API函数
module.exports = {
  // 用户登录
  login: (code) => {
    return request('/api/login', 'POST', { code })
  },

  // 创建走题任务
  createTask: (paperImageFileId) => {
    return request('/api/tasks', 'POST', { paperImageFileId })
  },

  // 获取任务列表
  getTasks: (userId, role) => {
    return request(`/api/tasks?userId=${userId}&role=${role}`, 'GET')
  },

  // 获取任务详情
  getTaskDetail: (taskId) => {
    return request(`/api/tasks/${taskId}`, 'GET')
  },

  // 开始任务
  startTask: (taskId) => {
    return request(`/api/tasks/${taskId}/start`, 'POST')
  },

  // 提交题目解题思路
  submitProblemSolution: (taskId, problemId, voiceFileId) => {
    return request(`/api/tasks/${taskId}/problems/${problemId}/solution`, 'POST', { voiceFileId })
  },

  // 获取AI反馈
  getAIFeedback: (taskId, problemId) => {
    return request(`/api/tasks/${taskId}/problems/${problemId}/feedback`, 'GET')
  },

  // 完成任务
  completeTask: (taskId) => {
    return request(`/api/tasks/${taskId}/complete`, 'POST')
  },

  // 上传文件
  uploadPaperImage: (filePath) => {
    return uploadFile(filePath, '/api/upload/paper')
  },

  // 上传语音
  uploadVoice: (filePath) => {
    return uploadFile(filePath, '/api/upload/voice')
  }
} 

