const API_CONFIG = {
  baseUrl: 'https://d.takin.shulie.io',
  apiKey: 'app-eyOgiYZWgmlt0tm0jyT4BiDz',
}

Page({
  data: {
    imagePath: '',
    analyzing: false,
    recognizedProblem: '',
    analyzeError: '',
    showResult: false
  },

  // 返回上一页
  navigateBack: function() {
    wx.navigateBack()
  },

  // 拍照
  takePhoto: function() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success(res) {
        that.setData({
          imagePath: res.tempFiles[0].tempFilePath
        })
      }
    })
  },

  // 从相册选择
  chooseImage: function() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success(res) {
        that.setData({
          imagePath: res.tempFiles[0].tempFilePath
        })
      }
    })
  },

  // 取消选择的图片
  cancelImage: function() {
    this.setData({
      imagePath: '',
      analyzing: false,
      recognizedProblem: '',
      analyzeError: '',
      showResult: false
    })
  },

  // 分析图片
  analyzeImage: function() {
    if (!this.data.imagePath) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      })
      return
    }

    this.setData({
      analyzing: true
    })

    const that = this
    const userId = wx.getStorageSync('userId') || 'guest'
    const BASE_URL = API_CONFIG.baseUrl
    const API_KEY = API_CONFIG.apiKey

    // 上传图片
    wx.uploadFile({
      url: `${BASE_URL}/v1/files/upload`,
      filePath: this.data.imagePath,
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
        console.log('上传响应状态码:', uploadRes.statusCode)
        console.log('上传响应原始数据:', uploadRes.data)
        
        if (uploadRes.statusCode >= 400) {
          console.error('上传失败，状态码:', uploadRes.statusCode)
          that.handleError(`上传失败，状态码: ${uploadRes.statusCode}`)
          return
        }
        
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
            that.handleError('未获取到上传文件ID')
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
    const userId = wx.getStorageSync('userId') || 'guest'
    console.log('开始调用对话API，文件ID:', uploadFileId, '用户ID:', userId)
    
    // 设置为分析中状态
    this.setData({
      analyzing: true,
      analyzeError: ''
    })
    
    wx.request({
      url: `${BASE_URL}/v1/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        conversation_id: null,  // 使用null而不是空字符串
        user: userId,
        files: [{
          type: "image",
          transfer_method: "local_file",
          upload_file_id: uploadFileId
        }],
        inputs: {
          text: "识别这张数学题目图片的内容"  // 将query移到inputs.text中
        },
        stream: false  // 添加stream参数，指定不使用流式响应
      },
      success(chatRes) {
        console.log('对话响应:', chatRes.data)
        
        if (chatRes.statusCode >= 400) {
          console.error('API错误:', chatRes.statusCode, chatRes.data)
          that.setData({
            analyzing: false,
            analyzeError: `API错误: ${chatRes.statusCode} - ${JSON.stringify(chatRes.data)}`
          })
          return
        }
        
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
                
                // 更新状态，显示识别结果
                that.setData({
                  analyzing: false,
                  recognizedProblem: Object.values(mergedProblems)[0]?.content || '未能识别题目内容',
                  showResult: true
                })
              } else {
                // 没有找到content字段
                that.setData({
                  analyzing: false,
                  recognizedProblem: '未能识别题目内容',
                  showResult: true
                })
              }
            } else if (typeof problems === 'string') {
              // 如果是纯文本，直接显示
              that.setData({
                analyzing: false,
                recognizedProblem: problems,
                showResult: true
              })
            } else {
              that.setData({
                analyzing: false,
                analyzeError: '无法解析识别结果',
                showResult: false
              })
            }
          } catch (e) {
            console.error('解析识别结果失败:', e)
            that.setData({
              analyzing: false,
              analyzeError: '解析识别结果失败: ' + e.message,
              showResult: false
            })
          }
        } else {
          console.error('响应中没有answer字段:', chatRes.data)
          that.setData({
            analyzing: false,
            analyzeError: '响应中没有识别结果',
            showResult: false
          })
        }
      },
      fail(error) {
        console.error('对话请求失败:', error)
        that.setData({
          analyzing: false,
          analyzeError: '对话请求失败: ' + error.errMsg,
          showResult: false
        })
      }
    })
  },

  // 处理错误
  handleError(message) {
    console.error(message)
    this.setData({
      analyzing: false,
      analyzeError: message,
      showResult: false
    })
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    })
  },

  // 创建任务
  createTask: function() {
    if (!this.data.recognizedProblem) {
      wx.showToast({
        title: '请先识别题目',
        icon: 'none'
      })
      return
    }

    // 从本地存储获取任务列表
    const tasks = wx.getStorageSync('mathTasks') || []
    
    // 生成新任务ID
    const newTaskId = Date.now().toString()
    
    // 创建新任务
    const newTask = {
      id: newTaskId,
      title: '拍照解题任务',
      createdAt: new Date().toISOString(),
      dueDate: this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 默认7天后截止
      status: '未开始',
      problems: {
        problem1: {
          content: this.data.recognizedProblem,
          answered: false
        }
      }
    }
    
    // 添加到任务列表
    tasks.unshift(newTask)
    
    // 保存到本地存储
    wx.setStorageSync('mathTasks', tasks)
    
    // 显示成功提示
    wx.showToast({
      title: '任务创建成功',
      icon: 'success'
    })
    
    // 导航到任务详情页
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/student/problemSolving/index?taskId=${newTaskId}`
      })
    }, 1500)
  },
  
  // 格式化日期为 YYYY-MM-DD
  formatDate: function(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}) 

