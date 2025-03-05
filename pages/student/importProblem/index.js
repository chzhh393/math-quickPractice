// 获取应用实例
const app = getApp()

Page({
  data: {
    jsonContent: '',
    parsedProblems: null,
    showPreview: false,
    parseError: ''
  },

  onLoad: function() {
    // 页面加载时的初始化
    console.log('导入题目页面加载')
  },
  
  // 返回上一页
  navigateBack: function() {
    // 获取当前页面栈
    const pages = getCurrentPages()
    
    // 如果页面栈只有一个页面，则跳转到首页
    if (pages.length <= 1) {
      wx.switchTab({
        url: '/pages/student/index/index',
        fail(error) {
          console.error('跳转到首页失败:', error)
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
  
  // 监听JSON输入变化
  onJsonInput: function(e) {
    console.log('输入内容变化:', e.detail.value.substring(0, 50) + '...')
    this.setData({
      jsonContent: e.detail.value,
      parseError: ''
    })
  },
  
  // 输入框内容变化的备用处理函数
  bindInputChange: function(e) {
    console.log('备用输入处理函数被调用')
    this.onJsonInput(e)
  },
  
  // 清空输入
  clearInput: function() {
    console.log('清空输入')
    this.setData({
      jsonContent: '',
      parseError: ''
    })
  },
  
  // 粘贴示例JSON
  pasteExample: function() {
    console.log('粘贴示例JSON')
    const exampleJson = `{
  "content1": "某家电商场计划用9万元从生产厂家家购进50台电视机.已知该厂家生产三种不同型号的电视机，出厂价分别为：甲种每台1500元，乙种每台2100元，丙种每台2500元.\\n(1)若该家电商场同时购进两种不同型号的电视机共50台，用去9万元，请你研究一下商场的进货方案；\\n(2)若该商场销售一台甲种电视机可获利150元，销售一台乙种电视机可获利200元，销售一台丙种电视机可获利250元，在(1)的方案中，为了使销售时获利最多，你选择哪种进货方案？",
  "content2": "点P从点A出发，以2个单位/秒的速度沿着"坡数轴"向右运动。同时点Q从点B出发，以每秒1个单位的速度沿着"坡数轴"向左运动。经过多久，PQ=2？\\n①点P从点A出发，以2个单位/秒的速度沿着"坡数轴"向右运动。同时点Q从点B出发，以每秒1个单位的速度沿着"坡数轴"向左运动。当P重新回到A点时所有运动结束。设P点运动时间为t秒，在移动过程中，何时PQ=2？PO？直接写出t的值。"
}`
    
    this.setData({
      jsonContent: exampleJson,
      parseError: ''
    })
  },
  
  // 直接解析粘贴的内容
  parseDirectly: function(content) {
    console.log('直接解析粘贴的内容')
    if (!content) {
      return null
    }
    
    try {
      // 尝试提取content键值对
      const problems = []
      
      // 使用正则表达式匹配"contentX": "内容"模式
      const regex = /"content(\d+)"\s*:\s*"([^"]*)"/g
      let match
      
      while ((match = regex.exec(content)) !== null) {
        const index = match[1]
        const contentText = match[2].replace(/\\n/g, '\n').trim()
        
        problems.push({
          index: index,
          content: contentText
        })
      }
      
      // 如果没有匹配到，尝试其他格式
      if (problems.length === 0) {
        // 尝试匹配contentX: "内容"格式（没有引号的键）
        const looseRegex = /content(\d+)\s*:\s*"([^"]*)"/g
        
        while ((match = looseRegex.exec(content)) !== null) {
          const index = match[1]
          const contentText = match[2].replace(/\\n/g, '\n').trim()
          
          problems.push({
            index: index,
            content: contentText
          })
        }
      }
      
      // 如果还是没有匹配到，尝试直接作为一个题目处理
      if (problems.length === 0) {
        problems.push({
          index: '1',
          content: content.trim()
        })
      }
      
      return problems
    } catch (error) {
      console.error('直接解析内容失败:', error)
      return null
    }
  },
  
  // 解析JSON
  parseJson: function() {
    console.log('开始解析JSON')
    if (!this.data.jsonContent) {
      this.setData({
        parseError: '请输入内容'
      })
      return
    }
    
    try {
      console.log('开始解析JSON数据，内容长度:', this.data.jsonContent.length)
      const inputContent = this.data.jsonContent.trim()
      
      // 尝试多种方式解析
      let problems = []
      
      // 方法1: 标准JSON解析
      try {
        console.log('尝试标准JSON解析')
        const preprocessedContent = this.preprocessJsonContent(inputContent)
        const jsonData = JSON.parse(preprocessedContent)
        
        // 提取content键值对
        for (const key in jsonData) {
          if (key.startsWith('content')) {
            const index = key.replace('content', '')
            const content = jsonData[key].replace(/\\n/g, '\n').trim()
            
            problems.push({
              index: index,
              content: content
            })
          }
        }
        
        console.log('标准JSON解析成功，提取到', problems.length, '个题目')
      } catch (parseError) {
        console.error('标准JSON解析失败:', parseError)
        
        // 方法2: 使用正则表达式提取
        console.log('尝试使用正则表达式提取')
        const extractedData = this.extractContentWithRegex(inputContent)
        
        if (extractedData && Object.keys(extractedData).length > 0) {
          for (const key in extractedData) {
            if (key.startsWith('content')) {
              const index = key.replace('content', '')
              const content = extractedData[key].replace(/\\n/g, '\n').trim()
              
              problems.push({
                index: index,
                content: content
              })
            }
          }
          console.log('正则表达式提取成功，提取到', problems.length, '个题目')
        } else {
          // 方法3: 直接解析
          console.log('尝试直接解析')
          const directProblems = this.parseDirectly(inputContent)
          if (directProblems && directProblems.length > 0) {
            problems = directProblems
            console.log('直接解析成功，提取到', problems.length, '个题目')
          } else {
            throw new Error('无法解析内容，请检查格式是否正确')
          }
        }
      }
      
      if (problems.length === 0) {
        throw new Error('未能提取到任何题目，请检查格式')
      }
      
      // 按题号排序
      problems.sort((a, b) => parseInt(a.index) - parseInt(b.index))
      
      console.log('最终提取的题目:', problems)
      
      // 设置解析结果
      this.setData({
        parsedProblems: problems,
        showPreview: true,
        parseError: ''
      })
      
    } catch (error) {
      console.error('解析JSON出错:', error)
      this.setData({
        parseError: '解析JSON出错: ' + error.message
      })
    }
  },
  
  // 预处理JSON内容，处理特殊字符
  preprocessJsonContent: function(content) {
    // 处理LaTeX表达式中的反斜杠和方括号
    let processed = content
    
    // 替换所有未转义的反斜杠为双反斜杠
    processed = processed.replace(/(?<!\\)\\(?!\\)/g, '\\\\')
    
    // 处理LaTeX中的方括号，在JSON解析前将它们转义
    processed = processed.replace(/\\\[/g, '\\\\[')
    processed = processed.replace(/\\\]/g, '\\\\]')
    
    return processed
  },
  
  // 使用正则表达式提取内容
  extractContentWithRegex: function(content) {
    console.log('使用正则表达式提取内容')
    const result = {}
    
    // 匹配 "contentX": "内容" 模式
    const regex = /"content(\d+)"\s*:\s*"([^"]*)"/g
    let match
    
    while ((match = regex.exec(content)) !== null) {
      const contentKey = 'content' + match[1]
      const contentValue = match[2]
      result[contentKey] = contentValue
    }
    
    // 如果没有匹配到任何内容，尝试更宽松的匹配
    if (Object.keys(result).length === 0) {
      console.log('尝试更宽松的正则匹配')
      
      // 尝试匹配没有引号的键值对
      const looseRegex = /content(\d+)\s*:\s*"([^"]*)"/g
      
      while ((match = looseRegex.exec(content)) !== null) {
        const contentKey = 'content' + match[1]
        const contentValue = match[2]
        result[contentKey] = contentValue
      }
      
      // 尝试匹配更宽松的格式
      if (Object.keys(result).length === 0) {
        console.log('尝试最宽松的正则匹配')
        const veryLooseRegex = /content(\d+)[^:]*:[^"]*"([^"]*)"/g
        
        while ((match = veryLooseRegex.exec(content)) !== null) {
          const contentKey = 'content' + match[1]
          const contentValue = match[2]
          result[contentKey] = contentValue
        }
      }
    }
    
    console.log('正则提取结果:', Object.keys(result).length, '个键值对')
    return result
  },
  
  // 返回编辑
  backToEdit: function() {
    this.setData({
      showPreview: false
    })
  },
  
  // 创建任务
  createTask: function() {
    if (!this.data.parsedProblems || this.data.parsedProblems.length === 0) {
      wx.showToast({
        title: '请先解析题目',
        icon: 'none'
      })
      return
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '正在创建任务...',
    })
    
    // 获取app实例
    const app = getApp()
    
    // 生成任务标题
    const now = new Date()
    const taskTitle = `导入题目任务 (${this.data.parsedProblems.length}题) ${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`
    
    // 准备识别数据
    const recognizedData = {
      title: taskTitle,
      problems: this.data.parsedProblems.map((problem, index) => {
        return {
          problem_key: `problem_${index + 1}`,
          content: problem.content,
          answered: false,
          problem_type: 'text',
          options: [],
          correct_answer: '',
          answer_records: []
        }
      })
    }
    
    console.log('准备保存的导入题目数据:', recognizedData)
    
    // 调用app.js中的saveRecognizedProblems函数保存到数据库
    app.saveRecognizedProblems(recognizedData).then(result => {
      console.log('保存导入题目结果:', result)
      wx.hideLoading()
      
      if (result.success) {
        // 显示成功提示
        wx.showToast({
          title: '任务创建成功',
          icon: 'success',
          duration: 1500
        })
        
        // 导航到任务详情页
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/student/problemSolving/index?taskId=${result.taskId}`
          })
        }, 1500)
      } else {
        // 显示错误提示
        wx.showToast({
          title: '创建任务失败: ' + (result.error || '未知错误'),
          icon: 'none',
          duration: 3000
        })
      }
    }).catch(error => {
      wx.hideLoading()
      console.error('保存导入题目出错:', error)
      wx.showToast({
        title: '创建任务出错',
        icon: 'none',
        duration: 3000
      })
    })
  },
  
  // 格式化日期为 YYYY-MM-DD
  formatDate: function(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}) 

