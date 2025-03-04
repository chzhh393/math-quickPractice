const API_CONFIG = {
  baseUrl: 'https://d.takin.shulie.io',
  apiKey: 'app-eyOgiYZWgmlt0tm0jyT4BiDz',
}

Page({
  data: {
    taskId: '',
    task: null,
    currentProblemIndex: 0,
    currentProblem: null,
    loading: true,
    errorMessage: '',
    // 语音相关状态
    isRecording: false,
    recordingTime: 0,
    recordingTimer: null,
    // 评估结果
    voiceAnswerText: '',
    answerExplanation: '',
    answerCorrect: false,
    showAnswerResult: false,
    errorType: '',
    specificError: '',
    // 会话ID
    conversationId: ''
  },

  onLoad: function(options) {
    if (options.taskId) {
      this.setData({
        taskId: options.taskId,
        errorType: '',
        specificError: ''
      })
      this.loadTaskDetails(options.taskId)
      // 初始化录音管理器
      this.initRecorderManager()
    } else {
      this.setData({
        loading: false,
        errorMessage: '未找到任务ID'
      })
    }
  },

  // 初始化录音管理器
  initRecorderManager: function() {
    this.recorderManager = wx.getRecorderManager()
    
    // 监听录音开始事件
    this.recorderManager.onStart(() => {
      console.log('录音开始')
      // 开始计时
      this.startRecordingTimer()
    })
    
    // 监听录音停止事件
    this.recorderManager.onStop((res) => {
      console.log('录音停止', res)
      // 停止计时
      this.stopRecordingTimer()
      
      // 获取录音文件
      const { tempFilePath } = res
      
      // 显示上传中状态
      wx.showLoading({
        title: '正在评估解题思路...',
      })
      
      // 上传录音文件进行解题思路评估
      this.uploadVoiceToAPI(tempFilePath)
    })
    
    // 监听录音错误事件
    this.recorderManager.onError((res) => {
      console.error('录音错误:', res)
      this.stopRecordingTimer()
      this.setData({
        isRecording: false
      })
      wx.showToast({
        title: '录音失败: ' + res.errMsg,
        icon: 'none'
      })
    })
  },

  // 开始录音
  startRecording: function() {
    // 录音配置
    const options = {
      duration: 60000, // 最长录音时间，单位ms
      sampleRate: 16000, // 采样率
      numberOfChannels: 1, // 录音通道数
      encodeBitRate: 48000, // 编码码率
      format: 'mp3', // 音频格式
      frameSize: 50 // 指定帧大小
    }
    
    // 开始录音
    this.recorderManager.start(options)
    
    this.setData({
      isRecording: true,
      recordingTime: 0,
      showAnswerResult: false // 隐藏之前的评估结果
    })
  },

  // 停止录音
  stopRecording: function() {
    this.recorderManager.stop()
    
    this.setData({
      isRecording: false
    })
  },

  // 开始录音计时器
  startRecordingTimer: function() {
    this.data.recordingTimer = setInterval(() => {
      this.setData({
        recordingTime: this.data.recordingTime + 1
      })
    }, 1000)
  },

  // 停止录音计时器
  stopRecordingTimer: function() {
    if (this.data.recordingTimer) {
      clearInterval(this.data.recordingTimer)
      this.setData({
        recordingTimer: null
      })
    }
  },

  // 上传语音到API
  uploadVoiceToAPI: function(filePath) {
    const that = this
    const userId = wx.getStorageSync('userId') || 'guest'
    const BASE_URL = API_CONFIG.baseUrl
    const API_KEY = API_CONFIG.apiKey
    
    // 第一步：上传文件
    wx.uploadFile({
      url: `${BASE_URL}/v1/files/upload`,
      filePath: filePath,
      name: 'file',
      formData: {
        user: userId
      },
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'multipart/form-data'
      },
      success(uploadRes) {
        console.log('语音上传响应:', uploadRes.data)
        
        try {
          const uploadResult = JSON.parse(uploadRes.data)
          const fileId = uploadResult.data?.id || uploadResult.id || uploadResult.upload_file_id
          
          if (fileId) {
            // 获取到文件ID后，发送到语音识别API
            that.processVoiceAnswer(fileId)
          } else {
            throw new Error('未获取到上传文件ID')
          }
        } catch (e) {
          console.error('上传响应解析失败:', e)
          wx.hideLoading()
          wx.showToast({
            title: '语音上传失败',
            icon: 'none'
          })
        }
      },
      fail(error) {
        console.error('上传请求失败:', error)
        wx.hideLoading()
        wx.showToast({
          title: '语音上传失败',
          icon: 'none'
        })
      }
    })
  },

  // 处理语音答案
  processVoiceAnswer: function(fileId) {
    const that = this
    const userId = wx.getStorageSync('userId') || 'guest'
    const BASE_URL = API_CONFIG.baseUrl
    const API_KEY = API_CONFIG.apiKey
    const conversationId = this.data.task.conversationId || ''
    const problemContent = this.data.currentProblem.content
    
    // 保存会话ID以便后续使用
    this.setData({
      conversationId: conversationId
    })
    
    // 调用API处理语音答案
    wx.request({
      url: `${BASE_URL}/v1/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        conversation_id: conversationId,
        user: userId,
        files: [{
          type: "audio",
          transfer_method: "local_file",
          upload_file_id: fileId
        }],
        inputs: {
          problem: problemContent
        },
        query: `解题思路评估;题目文本:${problemContent}`
      },
      success(res) {
        wx.hideLoading()
        console.log('语音处理响应:', res.data)
        
        // 保存新的会话ID
        if (res.data && res.data.conversation_id) {
          that.setData({
            conversationId: res.data.conversation_id
          })
        }
        
        if (res.data && res.data.answer) {
          try {
            // 尝试解析返回的JSON
            let result
            try {
              result = JSON.parse(res.data.answer)
            } catch (e) {
              // 如果解析失败，尝试提取JSON部分
              const jsonMatch = res.data.answer.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                result = JSON.parse(jsonMatch[0])
              } else {
                throw new Error('无法解析返回结果')
              }
            }
            
            // 更新UI显示结果
            that.setData({
              voiceAnswerText: result.voiceText || '未能识别语音内容',
              answerCorrect: result.correct || false,
              answerExplanation: result.feedback || result.explanation || '未提供解析',
              errorType: result.errorType || '',
              specificError: result.specificError || '',
              showAnswerResult: true
            })
            
            // 保存答题结果
            that.saveVoiceAnswerResult(result)
            
          } catch (e) {
            console.error('处理语音识别结果失败:', e)
            wx.showToast({
              title: '处理语音识别结果失败',
              icon: 'none'
            })
          }
        } else {
          wx.showToast({
            title: '未获取到语音识别结果',
            icon: 'none'
          })
        }
      },
      fail(error) {
        wx.hideLoading()
        console.error('语音处理请求失败:', error)
        wx.showToast({
          title: '语音处理请求失败',
          icon: 'none'
        })
      }
    })
  },

  // 保存语音答题结果
  saveVoiceAnswerResult: function(result) {
    const problemKeys = Object.keys(this.data.task.problems)
    const currentProblemKey = problemKeys[this.data.currentProblemIndex]
    const tasks = wx.getStorageSync('mathTasks') || []
    const taskIndex = tasks.findIndex(t => t.id.toString() === this.data.taskId.toString())
    
    if (taskIndex !== -1) {
      // 更新答案和结果
      tasks[taskIndex].problems[currentProblemKey].answered = true
      tasks[taskIndex].problems[currentProblemKey].userAnswer = result.voiceText || ''
      tasks[taskIndex].problems[currentProblemKey].correct = result.correct || false
      tasks[taskIndex].problems[currentProblemKey].explanation = result.feedback || result.explanation || ''
      tasks[taskIndex].problems[currentProblemKey].errorType = result.errorType || ''
      tasks[taskIndex].problems[currentProblemKey].specificError = result.specificError || ''
      
      // 检查是否所有题目都已回答
      const allAnswered = Object.keys(tasks[taskIndex].problems).every(key => 
        tasks[taskIndex].problems[key].answered
      )
      
      if (allAnswered) {
        tasks[taskIndex].status = '已完成'
      }
      
      // 保存更新
      wx.setStorageSync('mathTasks', tasks)
      
      // 更新当前任务和当前题目
      const updatedCurrentProblem = tasks[taskIndex].problems[currentProblemKey]
      this.setData({
        task: tasks[taskIndex],
        currentProblem: updatedCurrentProblem
      })
    }
  },

  loadTaskDetails: function(taskId) {
    this.setData({ loading: true })
    
    // 从本地存储获取任务
    const storedTasks = wx.getStorageSync('mathTasks') || []
    console.log('所有任务:', storedTasks)
    
    const task = storedTasks.find(t => t.id.toString() === taskId.toString())
    console.log('当前任务:', task)
    
    if (task) {
      // 确保每个问题都有解答状态
      const problems = task.problems
      console.log('任务中的题目:', problems)
      
      Object.keys(problems).forEach(key => {
        if (!problems[key].hasOwnProperty('answered')) {
          problems[key].answered = false
        }
      })
      
      // 获取当前题目
      const problemKeys = Object.keys(problems)
      const currentProblemKey = problemKeys[0] // 默认显示第一题
      const currentProblem = problems[currentProblemKey]
      
      this.setData({
        task: task,
        currentProblem: currentProblem, // 设置当前题目
        loading: false,
        // 如果已有答案结果，显示结果
        showAnswerResult: currentProblem.answered || false,
        voiceAnswerText: currentProblem.userAnswer || '',
        answerCorrect: currentProblem.correct || false,
        answerExplanation: currentProblem.explanation || '',
        errorType: currentProblem.errorType || '',
        specificError: currentProblem.specificError || '',
        // 保存会话ID
        conversationId: task.conversationId || ''
      })
      
      // 输出当前题目内容，帮助调试
      console.log('当前题目索引:', 0)
      console.log('当前题目键:', currentProblemKey)
      console.log('当前题目内容:', currentProblem)
      
      // 更新任务状态为进行中
      if (task.status === '未开始') {
        this.updateTaskStatus('进行中')
      }
    } else {
      this.setData({
        loading: false,
        errorMessage: '未找到任务详情'
      })
    }
  },

  // 切换到下一题
  nextProblem: function() {
    const problemKeys = Object.keys(this.data.task.problems)
    const currentIndex = this.data.currentProblemIndex
    
    if (currentIndex < problemKeys.length - 1) {
      const newIndex = currentIndex + 1
      const currentProblemKey = problemKeys[newIndex]
      const currentProblem = this.data.task.problems[currentProblemKey]
      
      this.setData({
        currentProblemIndex: newIndex,
        currentProblem: currentProblem, // 更新当前题目
        // 更新答题结果显示
        showAnswerResult: currentProblem.answered || false,
        voiceAnswerText: currentProblem.userAnswer || '',
        answerCorrect: currentProblem.correct || false,
        answerExplanation: currentProblem.explanation || '',
        errorType: currentProblem.errorType || '',
        specificError: currentProblem.specificError || ''
      })
      
      // 输出当前题目内容，帮助调试
      console.log('切换到下一题 - 索引:', newIndex)
      console.log('切换到下一题 - 键:', currentProblemKey)
      console.log('切换到下一题 - 内容:', currentProblem)
    }
  },

  // 切换到上一题
  prevProblem: function() {
    const problemKeys = Object.keys(this.data.task.problems)
    const currentIndex = this.data.currentProblemIndex
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      const currentProblemKey = problemKeys[newIndex]
      const currentProblem = this.data.task.problems[currentProblemKey]
      
      this.setData({
        currentProblemIndex: newIndex,
        currentProblem: currentProblem, // 更新当前题目
        // 更新答题结果显示
        showAnswerResult: currentProblem.answered || false,
        voiceAnswerText: currentProblem.userAnswer || '',
        answerCorrect: currentProblem.correct || false,
        answerExplanation: currentProblem.explanation || '',
        errorType: currentProblem.errorType || '',
        specificError: currentProblem.specificError || ''
      })
      
      // 输出当前题目内容，帮助调试
      console.log('切换到上一题 - 索引:', newIndex)
      console.log('切换到上一题 - 键:', currentProblemKey)
      console.log('切换到上一题 - 内容:', currentProblem)
    }
  },

  // 更新任务状态
  updateTaskStatus: function(status) {
    const tasks = wx.getStorageSync('mathTasks') || []
    const taskIndex = tasks.findIndex(t => t.id.toString() === this.data.taskId.toString())
    
    if (taskIndex !== -1) {
      tasks[taskIndex].status = status
      wx.setStorageSync('mathTasks', tasks)
      
      // 更新当前任务
      this.setData({
        task: tasks[taskIndex]
      })
    }
  },

  // 返回任务列表
  backToTaskList: function() {
    wx.navigateBack()
  }
}) 

