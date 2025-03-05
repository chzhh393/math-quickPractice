// 获取全局app实例
const app = getApp()

// 定义API配置，优先使用本地配置，如果未定义则尝试从全局获取
const API_CONFIG = {
  baseUrl: 'https://d.takin.shulie.io',
  apiKey: 'app-eyOgiYZWgmlt0tm0jyT4BiDz',
}

// 定义全局变量，确保所有函数都能访问
// 添加错误处理，如果本地变量未定义，尝试从全局获取
let BASE_URL = API_CONFIG.baseUrl
let API_KEY = API_CONFIG.apiKey

// 如果本地变量未定义，尝试从全局获取
if (!BASE_URL && app && app.globalData) {
  console.log('本地BASE_URL未定义，尝试从全局获取')
  BASE_URL = app.globalData.BASE_URL
}

if (!API_KEY && app && app.globalData) {
  console.log('本地API_KEY未定义，尝试从全局获取')
  API_KEY = app.globalData.API_KEY
}

// 确保变量已定义
if (!BASE_URL) {
  console.error('警告: BASE_URL未定义，将使用默认值')
  BASE_URL = 'https://d.takin.shulie.io'
}

if (!API_KEY) {
  console.error('警告: API_KEY未定义，将使用默认值')
  API_KEY = 'app-eyOgiYZWgmlt0tm0jyT4BiDz'
}

console.log('PhotoSolve页面初始化，使用API配置:', BASE_URL)

Page({
  data: {
    imagePath: '',
    analyzing: false,
    recognizedProblems: [],
    analyzeError: '',
    showResult: false
  },

  // 返回上一页
  navigateBack: function() {
    // 获取当前页面栈
    const pages = getCurrentPages()
    console.log('当前页面栈:', pages.length)
    
    // 如果页面栈只有一个页面，则跳转到首页
    if (pages.length <= 1) {
      console.log('当前已是第一个页面，跳转到首页')
      wx.switchTab({
        url: '/pages/student/index/index',
        fail(error) {
          console.error('跳转到首页失败:', error)
          // 如果switchTab失败，尝试使用redirectTo
          wx.redirectTo({
            url: '/pages/student/index/index',
            fail(err) {
              console.error('重定向到首页也失败:', err)
              wx.showToast({
                title: '返回失败，请手动返回',
                icon: 'none'
              })
            }
          })
        }
      })
    } else {
      // 如果有上一页，则正常返回
      wx.navigateBack({
        fail(error) {
          console.error('返回上一页失败:', error)
          // 如果navigateBack失败，尝试使用redirectTo
          wx.redirectTo({
            url: '/pages/student/index/index',
            fail(err) {
              console.error('重定向到首页也失败:', err)
              wx.showToast({
                title: '返回失败，请手动返回',
                icon: 'none'
              })
            }
          })
        }
      })
    }
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
      recognizedProblems: [],
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
      analyzing: true,
      analyzeError: '',
      showResult: false
    })

    const that = this
    const userId = wx.getStorageSync('userId') || 'guest'
    
    console.log('开始上传图片，API配置:', BASE_URL)
    
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
    console.log('开始调用对话API，文件ID:', uploadFileId, '用户ID:', userId)
    
    // 设置加载状态
    this.setData({
      analyzing: true,
      analyzeError: ''
    })
    
    // 准备请求数据 - 确保包含所有必要参数
    const requestData = {
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
    }
    
    console.log('发送请求数据:', JSON.stringify(requestData))
    
    // 发送API请求
    wx.request({
      url: `${BASE_URL}/v1/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      success(chatRes) {
        console.log('对话响应:', chatRes.data)
        
        // 重置分析状态
        that.setData({
          analyzing: false
        })
        
        if (chatRes.data && chatRes.data.answer) {
          try {
            // 解析识别结果
            let problems = chatRes.data.answer
            console.log('原始answer内容:', problems)
            
            // 处理特殊格式的返回数据
            if (typeof problems === 'string') {
              // 检查是否包含多个content标记
              if (problems.includes('"content1"') || problems.includes('"content2"')) {
                console.log('检测到特殊格式的多题目数据')
                
                // 尝试提取所有content
                const contentMatches = problems.match(/"content\d+"[,:]?\s*"([^"]+)"/g)
                if (contentMatches && contentMatches.length > 0) {
                  console.log('找到内容匹配:', contentMatches)
                  
                  const extractedProblems = {}
                  contentMatches.forEach((match, index) => {
                    // 提取content键和值
                    const contentKeyMatch = match.match(/"(content\d+)"/)
                    const contentKey = contentKeyMatch ? contentKeyMatch[1] : `content${index + 1}`
                    
                    // 提取内容值
                    const contentValueMatch = match.match(/"content\d+"[,:]?\s*"([^"]+)"/)
                    const contentValue = contentValueMatch ? contentValueMatch[1] : ''
                    
                    if (contentValue) {
                      extractedProblems[contentKey] = contentValue.replace(/\\n/g, '\n')
                    }
                  })
                  
                  console.log('提取的多个题目:', extractedProblems)
                  problems = extractedProblems
                } else {
                  // 如果匹配失败，尝试其他方法
                  try {
                    // 尝试将字符串转换为有效的JSON
                    const cleanedStr = problems
                      .replace(/\\"/g, '"')
                      .replace(/"\s*,\s*"/g, '","')
                      .replace(/"\s*;\s*\n+\s*"/g, '","')
                    
                    // 构建一个有效的JSON对象字符串
                    const jsonStr = `{${cleanedStr.replace(/^"/, '"').replace(/";$/, '"')}}`;
                    console.log('尝试解析为JSON:', jsonStr)
                    
                    problems = JSON.parse(jsonStr)
                    console.log('JSON解析成功:', problems)
                  } catch (e) {
                    console.error('JSON解析失败:', e)
                    
                    // 如果JSON解析失败，使用正则表达式提取
                    const contentPairs = problems.split(/;\s*\n+\s*/)
                    if (contentPairs.length > 1) {
                      problems = {}
                      contentPairs.forEach((pair, index) => {
                        const parts = pair.split(',')
                        if (parts.length >= 2) {
                          const key = parts[0].replace(/"/g, '').trim()
                          const value = parts[1].replace(/"/g, '').trim()
                          problems[key] = value
                        } else {
                          problems[`content${index + 1}`] = pair.replace(/"/g, '').trim()
                        }
                      })
                    }
                  }
                }
              } else {
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
                
                // 更新UI显示所有识别结果
                that.setData({
                  recognizedProblems: Object.values(mergedProblems),
                  showResult: true
                })
              } else {
                that.handleError('未能识别题目内容')
              }
            } else {
              // 如果是字符串，直接显示为单个题目
              that.setData({
                recognizedProblems: typeof problems === 'string' 
                  ? [{ content: problems, index: '1' }] 
                  : [],
                showResult: true
              })
            }
          } catch (e) {
            console.error('处理识别结果时出错:', e)
            that.handleError('处理识别结果时出错: ' + e.message)
          }
        } else {
          console.error('响应中没有answer字段:', chatRes.data)
          that.handleError('未获取到识别结果')
        }
      },
      fail(error) {
        console.error('对话请求失败:', error)
        that.setData({
          analyzing: false
        })
        that.handleError('识别请求失败: ' + error.errMsg)
      }
    })
  },

  // 处理错误
  handleError(message) {
    console.error(message)
    this.setData({
      analyzeError: message,
      analyzing: false
    })
    
    // 显示错误提示
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    })
  },

  // 添加备用API调用方法
  callChatAPIAlternative(uploadFileId) {
    const that = this
    const userId = wx.getStorageSync('userId') || this.data.userId || 'guest'
    console.log('使用备用方法调用对话API，文件ID:', uploadFileId)
    
    this.setData({
      analyzing: true,
      analyzeError: ''
    })
    
    // 准备备用请求数据 - 确保包含所有必要参数
    const requestData = {
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
    }
    
    console.log('备用方法发送请求数据:', JSON.stringify(requestData))
    
    wx.request({
      url: `${BASE_URL}/v1/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      success(chatRes) {
        console.log('备用方法对话响应:', chatRes.data)
        
        that.setData({
          analyzing: false
        })
        
        if (chatRes.data && chatRes.data.answer) {
          try {
            let problems = chatRes.data.answer
            console.log('原始answer内容:', problems)
            
            // 处理特殊格式的返回数据
            if (typeof problems === 'string') {
              // 检查是否包含多个content标记
              if (problems.includes('"content1"') || problems.includes('"content2"')) {
                console.log('备用方法检测到特殊格式的多题目数据')
                
                // 尝试提取所有content
                const contentMatches = problems.match(/"content\d+"[,:]?\s*"([^"]+)"/g)
                if (contentMatches && contentMatches.length > 0) {
                  console.log('备用方法找到内容匹配:', contentMatches)
                  
                  const extractedProblems = {}
                  contentMatches.forEach((match, index) => {
                    // 提取content键和值
                    const contentKeyMatch = match.match(/"(content\d+)"/)
                    const contentKey = contentKeyMatch ? contentKeyMatch[1] : `content${index + 1}`
                    
                    // 提取内容值
                    const contentValueMatch = match.match(/"content\d+"[,:]?\s*"([^"]+)"/)
                    const contentValue = contentValueMatch ? contentValueMatch[1] : ''
                    
                    if (contentValue) {
                      extractedProblems[contentKey] = contentValue.replace(/\\n/g, '\n')
                    }
                  })
                  
                  console.log('备用方法提取的多个题目:', extractedProblems)
                  
                  // 转换为数组格式
                  const problemsArray = Object.keys(extractedProblems).map(key => {
                    return {
                      content: extractedProblems[key],
                      index: key.replace('content', '')
                    }
                  })
                  
                  // 更新UI显示所有识别结果
                  that.setData({
                    recognizedProblems: problemsArray,
                    showResult: true
                  })
                  return
                }
              }
              
              // 如果没有检测到特殊格式，使用简单处理
              problems = problems.replace(/\\n/g, '\n').replace(/\\r/g, '')
            } else if (typeof problems === 'object') {
              // 如果是对象，检查是否有content字段
              const contentKeys = Object.keys(problems).filter(key => key.startsWith('content'))
              if (contentKeys.length > 0) {
                const problemsArray = contentKeys.map(key => {
                  return {
                    content: problems[key].replace(/\\n/g, '\n').replace(/\\r/g, ''),
                    index: key.replace('content', '')
                  }
                })
                
                that.setData({
                  recognizedProblems: problemsArray,
                  showResult: true
                })
                return
              } else {
                problems = JSON.stringify(problems)
              }
            }
            
            // 如果上面的处理都没有返回，则作为单个题目处理
            that.setData({
              recognizedProblems: [{ 
                content: typeof problems === 'string' ? problems : JSON.stringify(problems), 
                index: '1' 
              }],
              showResult: true
            })
          } catch (e) {
            console.error('处理识别结果时出错:', e)
            that.handleError('处理识别结果时出错: ' + e.message)
          }
        } else {
          console.error('响应中没有answer字段:', chatRes.data)
          that.handleError('未获取到识别结果')
        }
      },
      fail(error) {
        console.error('备用方法对话请求失败:', error)
        that.setData({
          analyzing: false
        })
        
        // 如果备用方法也失败，提供更详细的错误信息
        if (error.statusCode === 400) {
          console.log('尝试解析错误响应:', error.data)
          let errorMsg = '请求格式错误'
          try {
            if (typeof error.data === 'string') {
              const errorData = JSON.parse(error.data)
              errorMsg = errorData.message || errorData.error || errorMsg
            } else if (error.data && error.data.message) {
              errorMsg = error.data.message
            }
          } catch (e) {
            console.error('解析错误响应失败:', e)
          }
          that.handleError('识别请求失败: ' + errorMsg)
        } else {
          that.handleError('识别请求失败: ' + error.errMsg)
        }
      }
    })
  },

  // 创建任务
  createTask: function() {
    if (!this.data.recognizedProblems || this.data.recognizedProblems.length === 0) {
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
    
    // 创建题目对象
    const problems = {}
    this.data.recognizedProblems.forEach((problem, index) => {
      problems[`problem${index + 1}`] = {
        content: problem.content,
        answered: false
      }
    })
    
    // 创建新任务
    const newTask = {
      id: newTaskId,
      title: `拍照解题任务 (${this.data.recognizedProblems.length}题)`,
      createdAt: new Date().toISOString(),
      dueDate: this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 默认7天后截止
      status: '未开始',
      problems: problems
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

