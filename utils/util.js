/**
 * 格式化时间
 * @param {Date} date - 日期对象
 * @returns {String} - 格式化后的时间字符串
 */
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

/**
 * 格式化数字
 * @param {Number} n - 数字
 * @returns {String} - 格式化后的数字字符串
 */
const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 计算两个时间的时间差（分钟）
 * @param {Date} startTime - 开始时间
 * @param {Date} endTime - 结束时间
 * @returns {Number} - 时间差（分钟）
 */
const calculateTimeDiff = (startTime, endTime) => {
  const diff = (endTime - startTime) / 1000 / 60
  return Math.floor(diff)
}

/**
 * 格式化时间差为可读形式
 * @param {Number} minutes - 分钟数
 * @returns {String} - 格式化后的时间差
 */
const formatTimeDiff = (minutes) => {
  if (minutes < 60) {
    return `${minutes}分钟`
  } else {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}小时${mins}分钟`
  }
}

/**
 * 显示消息提示框
 * @param {String} title - 提示内容
 * @param {String} icon - 图标，有效值 "success", "error", "loading", "none"
 */
const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 2000
  })
}

/**
 * 显示模态对话框
 * @param {String} title - 标题
 * @param {String} content - 内容
 * @param {Boolean} showCancel - 是否显示取消按钮
 * @returns {Promise} - 返回Promise对象
 */
const showModal = (title, content, showCancel = true) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title,
      content,
      showCancel,
      success: (res) => {
        if (res.confirm) {
          resolve(true)
        } else if (res.cancel) {
          resolve(false)
        }
      },
      fail: () => {
        reject(new Error('显示对话框失败'))
      }
    })
  })
}

module.exports = {
  formatTime,
  formatNumber,
  calculateTimeDiff,
  formatTimeDiff,
  showToast,
  showModal
} 

