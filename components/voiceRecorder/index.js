const api = require('../../utils/api')
const util = require('../../utils/util')

Component({
  properties: {
    taskId: {
      type: String,
      value: ''
    },
    problemId: {
      type: String,
      value: ''
    }
  },

  data: {
    isRecording: false,
    recordingTime: 0,
    recordingTimer: null,
    tempFilePath: '',
    buttonText: '开始录音',
    isSubmitting: false
  },

  lifetimes: {
    attached() {
      // 检查录音权限
      wx.authorize({
        scope: 'scope.record',
        success: () => {
          console.log('录音权限已获取')
        },
        fail: () => {
          util.showToast('请授予录音权限以便讲述解题思路')
        }
      })

      // 初始化录音管理器
      this.recorderManager = wx.getRecorderManager()

      this.recorderManager.onStart(() => {
        console.log('录音开始')
        this.setData({
          isRecording: true,
          recordingTime: 0,
          buttonText: '停止录音'
        })

        // 计时器，每秒更新录音时间
        this.data.recordingTimer = setInterval(() => {
          this.setData({
            recordingTime: this.data.recordingTime + 1
          })
        }, 1000)
      })

      this.recorderManager.onStop((res) => {
        console.log('录音结束', res)
        clearInterval(this.data.recordingTimer)
        this.setData({
          isRecording: false,
          tempFilePath: res.tempFilePath,
          buttonText: '重新录音'
        })

        // 播放提示音
        wx.vibrateShort()
      })

      this.recorderManager.onError((res) => {
        console.error('录音错误', res)
        clearInterval(this.data.recordingTimer)
        this.setData({
          isRecording: false,
          buttonText: '开始录音'
        })
        util.showToast('录音出错，请重试')
      })
    },

    detached() {
      // 组件销毁时，确保清理计时器
      if (this.data.recordingTimer) {
        clearInterval(this.data.recordingTimer)
      }
    }
  },

  methods: {
    // 切换录音状态
    toggleRecording() {
      if (this.data.isRecording) {
        // 停止录音
        this.recorderManager.stop()
      } else {
        // 开始录音
        if (this.data.tempFilePath) {
          // 已经有录音，询问是否重新录制
          util.showModal('重新录音', '确定要放弃当前录音并重新开始吗？').then(res => {
            if (res) {
              this.startRecording()
            }
          })
        } else {
          this.startRecording()
        }
      }
    },

    // 开始录音
    startRecording() {
      const options = {
        duration: 300000, // 最长5分钟
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 64000,
        format: 'mp3'
      }
      this.recorderManager.start(options)
    },

    // 播放录音
    playRecording() {
      if (!this.data.tempFilePath) {
        util.showToast('没有录音可播放')
        return
      }

      const innerAudioContext = wx.createInnerAudioContext()
      innerAudioContext.src = this.data.tempFilePath
      innerAudioContext.play()

      innerAudioContext.onPlay(() => {
        console.log('开始播放录音')
        util.showToast('正在播放录音', 'none')
      })

      innerAudioContext.onEnded(() => {
        console.log('录音播放结束')
      })

      innerAudioContext.onError((res) => {
        console.error('录音播放错误', res)
        util.showToast('播放出错，请重试')
      })
    },

    // 提交录音
    submitRecording() {
      if (!this.data.tempFilePath) {
        util.showToast('请先录制解题思路')
        return
      }

      if (this.data.isSubmitting) {
        return
      }

      this.setData({ isSubmitting: true })
      util.showToast('正在提交...', 'loading')

      // 先上传录音文件
      api.uploadVoice(this.data.tempFilePath).then(res => {
        const voiceFileId = res.fileId
        // 提交解题思路
        return api.submitProblemSolution(this.properties.taskId, this.properties.problemId, voiceFileId)
      }).then(res => {
        this.setData({ isSubmitting: false })
        util.showToast('提交成功', 'success')
        // 触发提交成功事件
        this.triggerEvent('submitsuccess', res)
      }).catch(error => {
        console.error('提交失败', error)
        this.setData({ isSubmitting: false })
        util.showToast('提交失败，请重试')
      })
    },

    // 格式化录音时间
    formatRecordingTime() {
      const minutes = Math.floor(this.data.recordingTime / 60)
      const seconds = this.data.recordingTime % 60
      return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
    }
  }
}) 

