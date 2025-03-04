const util = require('../../utils/util')

Component({
  properties: {
    tasks: {
      type: Array,
      value: []
    },
    loading: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    // 点击任务
    onTaskTap(e) {
      const taskId = e.currentTarget.dataset.id
      this.triggerEvent('tasktap', { taskId })
    },

    // 格式化任务状态
    formatStatus(status) {
      const statusMap = {
        'created': '未开始',
        'in_progress': '进行中',
        'completed': '已完成'
      }
      return statusMap[status] || '未知状态'
    },

    // 格式化完成度
    formatCompletion(task) {
      if (!task.problemCount) return '0%'
      const completion = (task.completedCount / task.problemCount) * 100
      return `${Math.floor(completion)}%`
    },

    // 计算时间差
    calculateDuration(task) {
      if (task.status === 'created') {
        return '尚未开始'
      }
      
      if (!task.startTime) {
        return '时间未知'
      }
      
      const startTime = new Date(task.startTime)
      const endTime = task.status === 'completed' && task.completionTime 
        ? new Date(task.completionTime)
        : new Date()
        
      return util.formatTimeDiff(util.calculateTimeDiff(startTime, endTime))
    }
  }
}) 

