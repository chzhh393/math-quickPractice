const API_CONFIG = {
  baseUrl: 'https://d.takin.shulie.io',
  apiKey: 'app-eyOgiYZWgmlt0tm0jyT4BiDz',
}

Page({
  data: {
    tempImagePath: '',
    hasImage: false,
    isUploading: false,
    userId: '',
    recognizedProblems: null,
    errorMessage: '',
    showError: false
  },

  onLoad: function() {
    // 获取用户ID，如果没有则生成一个临时ID
    const userId = wx.getStorageSync('userId') || `user_${Date.now()}`
    this.setData({
      userId: userId
    })
    if (!wx.getStorageSync('userId')) {
      wx.setStorageSync('userId', userId)
    }
  },

  // 拍照或从相册选择图片
  chooseImage: function() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success(res) {
        console.log('选择图片成功:', res)
        that.setData({
          tempImagePath: res.tempFiles[0].tempFilePath,
          hasImage: true,
          recognizedProblems: null,
          errorMessage: '',
          showError: false
        })
      },
      fail(err) {
        console.error('选择图片失败:', err)
      }
    })
  },

  // 上传图片并识别
  uploadAndRecognize: function() {
    if (!this.data.tempImagePath) {
      this.handleError('请先选择或拍摄一张图片')
      return
    }

    this.setData({
      isUploading: true,
      errorMessage: '',
      showError: false
    })

    const that = this
    const userId = this.data.userId
    const BASE_URL = API_CONFIG.baseUrl
    const API_KEY = API_CONFIG.apiKey

    console.log('开始上传图片，用户ID:', userId)

    // 第一步：上传文件
    wx.uploadFile({
      url: `${BASE_URL}/v1/files/upload`,
      filePath: this.data.tempImagePath,
      name: 'file',
      formData: {
        user: userId
      },
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'multipart/form-data'
      },
      success(uploadRes) {
        // 添加详细日志
        console.log('上传响应原始数据:', uploadRes.data)
        
        try {
          const uploadResult = JSON.parse(uploadRes.data)
          console.log('解析后的上传响应:', uploadResult)
          
          // 检查响应中的文件ID（根据实际响应结构调整）
          const fileId = uploadResult.data?.id || uploadResult.id || uploadResult.upload_file_id
          
          if (fileId) {
            console.log('获取到的文件ID:', fileId)
            that.callChatAPI(fileId)
          } else {
            console.error('响应中没有找到文件ID:', uploadResult)
            throw new Error('未获取到上传文件ID')
          }
        } catch (e) {
          console.error('上传响应解析失败:', e)
          console.error('原始响应数据:', uploadRes.data)
          that.handleError('文件上传失败: ' + e.message)
        }
      },
      fail(error) {
        console.error('上传请求失败:', error)
        that.handleError('文件上传失败: ' + error.errMsg)
      }
    })
  },

  // 调用对话 API
  callChatAPI(uploadFileId) {
    const that = this
    const userId = wx.getStorageSync('userId') || this.data.userId || 'guest'
    const BASE_URL = API_CONFIG.baseUrl
    const API_KEY = API_CONFIG.apiKey
    
    console.log('开始调用对话API，文件ID:', uploadFileId, '用户ID:', userId)
    
    wx.request({
      url: `${BASE_URL}/v1/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        conversation_id: "",  // 拍照识别时使用空字符串创建新的会话
        user: userId,
        files: [{
          type: "image",
          transfer_method: "local_file",
          upload_file_id: uploadFileId
        }],
        inputs: {
          // 即使为空也需要包含inputs字段
        },
        query: "识别这张数学题目图片的内容"
      },
      success(chatRes) {
        console.log('对话响应:', chatRes.data)
        
        if (chatRes.data && chatRes.data.answer) {
          try {
            // 解析识别结果
            let problems = chatRes.data.answer
            console.log('原始answer内容:', problems)
            
            if (typeof problems === 'string') {
              try {
                // 先尝试直接解析
                problems = JSON.parse(problems)
              } catch (e) {
                console.log('直接解析失败，尝试清理字符串')
                // 移除可能的外层引号和转义字符
                problems = problems.replace(/\\"/g, '"')
                  .replace(/。}/g, '}')
                  .replace(/。"/g, '"')
                  .replace(/[，。](?=\s*["}])/g, '')
                if (problems.startsWith('"') && problems.endsWith('"')) {
                  problems = problems.slice(1, -1)
                }
                console.log('处理后的字符串:', problems)
                try {
                  problems = JSON.parse(problems)
                } catch (err) {
                  // 如果还是解析失败，尝试提取内容
                  console.log('JSON解析失败，尝试提取内容')
                  // 尝试匹配所有 content 字段
                  const contentMatches = problems.match(/content\d+["']?\s*:\s*["']([^"']+)["']/g)
                  if (contentMatches) {
                    problems = {}
                    contentMatches.forEach((match, index) => {
                      const content = match.match(/:\s*["']([^"']+)["']/)[1]
                      problems[`content${index + 1}`] = content
                    })
                  } else {
                    // 如果没有找到 content，直接使用整个文本
                    problems = {
                      content1: problems.replace(/['"{}]/g, '').trim()
                    }
                  }
                  console.log('提取的内容:', problems)
                }
              }
            }
            
            console.log('解析后的题目数据:', problems)
            
            // 检查是否有多个 content 字段
            if (problems && typeof problems === 'object') {
              const contentKeys = Object.keys(problems).filter(key => key.startsWith('content'))
              if (contentKeys.length > 0) {
                // 保存当前获取到的 conversation_id
                const newConversationId = chatRes.data.conversation_id
                console.log('拍照识别获取到的 conversation_id:', newConversationId)
                
                const mergedProblems = {}
                contentKeys.forEach(key => {
                  const index = key.replace('content', '')
                  mergedProblems[index] = {
                    // 先处理换行符，再去除首尾空白
                    content: problems[key]
                      .replace(/\\n/g, '\n')  // 转换 \n 为实际换行符
                      .replace(/\\r/g, '')    // 移除 \r
                      .replace(/^\s+|\s+$/g, ''),  // 去除首尾空白
                    index: index
                  }
                })
                
                console.log('识别出多个题目:', mergedProblems)
                
                // 更新UI显示识别结果
                that.setData({
                  recognizedProblems: mergedProblems,
                  isUploading: false
                })
                
                // 创建走题任务
                that.createTask(mergedProblems, newConversationId)
              } else {
                that.handleError('未能识别出有效题目内容')
              }
            } else {
              that.handleError('识别结果格式不正确')
            }
          } catch (e) {
            console.error('处理识别结果时出错:', e)
            that.handleError('处理识别结果失败: ' + e.message)
          }
        } else {
          that.handleError('未获取到识别结果')
        }
      },
      fail(error) {
        console.error('调用对话API失败:', error)
        that.handleError('识别请求失败: ' + error.errMsg)
      }
    })
  },

  // 创建走题任务
  createTask: function(problems, conversationId) {
    console.log('开始创建走题任务')
    
    // 生成任务标题
    const now = new Date()
    const taskTitle = `数学走题 ${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`
    
    // 这里可以调用创建任务的API，或者先保存到本地
    // 简单示例：保存到本地存储
    const tasks = wx.getStorageSync('mathTasks') || []
    const newTask = {
      id: Date.now().toString(),
      title: taskTitle,
      date: `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`,
      status: '未开始',
      problems: problems,
      conversationId: conversationId,
      createdAt: now.toISOString()
    }
    
    tasks.unshift(newTask)
    wx.setStorageSync('mathTasks', tasks)
    
    // 显示成功提示
    wx.showToast({
      title: '走题任务已创建',
      icon: 'success',
      duration: 2000,
      success: () => {
        // 延迟导航到任务列表
        setTimeout(() => {
          wx.navigateTo({
            url: '../taskList/index'
          })
        }, 2000)
      }
    })
  },

  // 处理错误
  handleError: function(message) {
    console.error('错误:', message)
    this.setData({
      isUploading: false,
      errorMessage: message,
      showError: true
    })
    
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    })
  },

  // 重新拍照
  retakePhoto: function() {
    this.setData({
      tempImagePath: '',
      hasImage: false,
      recognizedProblems: null,
      errorMessage: '',
      showError: false
    })
  }
}) 

