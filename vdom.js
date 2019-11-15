

const VNodeType = {
  // 组件待扩展
  HTML:'HTML',
  TEXT:'TEXT',
  COMPONENT:'COMPONENT',
}

let ChildType = {
	EMPTY: 'EMPTY',
	SINGLE: 'SINGLE',
	MULTIPLE: 'MULTIPLE'
}

/*
* @desc:  创建虚拟DOM
* @param: tag html标签/class组件/func组件
* @param: data 属性：包括style, class...
* @param: children 子节点
*/
function createElement(
	tag,
	data = null,
	children = null
){
	// 通过这个字段，判断当前传入的是html标签/class组件/func组件
	let flags
	// 通过这个字段，判断子节点是空/单个/多个
	let childFlags = null
	if (typeof tag === 'string') {
		flags = VNodeType.HTML
	} else if (typeof tag === 'function') {
		// class组件/func组件
		flags = VNodeType.COMPONENT
	}

	if (children == null) {
		childFlags = ChildType.EMPTY
	} else if (Array.isArray(children)) {
		if (children.length == 0) {
			childFlags = ChildType.EMPTY 
		} else {
			childFlags = ChildType.MULTIPLE
		}
	} else {
		// 单个子节点，作为文本节点处理
		childFlags = ChildType.SINGLE
		// 创建文本虚拟节点
		children = createTextVNode(children + '')
	}

	// 返回虚拟DOM对象
	return {
		flags,
		childFlags,
		tag,
		data,
		key: data ? data.key : null,
		children
	}
}



/*
* 创建文本虚拟节点
*/
function createTextVNode(text) {
	return {
		flags: VNodeType.TEXT,
		tag: null,
		data: null,
		children: text,
		childrenFlags: ChildType.EMPTY
	}
}


/*
* @desc: 渲染虚拟DOM到容器； 
* @param: vnode 虚拟DOM对象
* @param: container 容器
*/
function render(vnode, container) {
	const prevVNode = container.vnode
	if (!prevVNode) {
		// 挂载; 第一次
		mount(vnode, container)
	} else {
		// 对比新旧
		patch(prevVNode, vnode, container)
	}
	// 把虚拟DOM, 挂载到当前的容器上，方便后续使用
	container.vnode = vnode
}


/*
* @desc: 虚拟DOM挂载到容器中
* @param: vnode 虚拟DOM对象
* @param: container 容器
*/
function mount(vnode, container, refNode) {
	// 判断虚拟DOM的类型，不同的类型，做不同的挂载动作
	const { flags } = vnode
	if (flags === VNodeType.HTML) {
		// 挂载普通标签
		mountElement(vnode, container, refNode)
	} else if (flags === VNodeType.TEXT) {
		// 挂载文本
		mountText(vnode, container)
	}
}


/*
* @desc: 挂载元素
* @param: vnode 虚拟DOM对象
* @param: container 容器
*/
function mountElement(vnode, container, refNode) {
	const { tag, data, children, childFlags } = vnode
	const el = document.createElement(tag)
	vnode = el
	// 在挂载之前，把虚拟DOM上的其他属性赋到元素身上
	if (data) {
		for (let attr in data) {
			// style class key ...
			patchData(el, attr, null, data[attr])
		}
	}
	// 当前虚拟DOM的children， 同样要挂载
	// 递归处理
	if (childFlags !== ChildType.EMPTY) {
		if (childFlags === ChildType.SINGLE) {
			// 文本节点
			mount(children, el)
		} else if(childFlags === ChildType.MULTIPLE) {
			children.forEach(c => {
				// 挂载
				mount(c, el)
			})
		}
	}
	refNode ? container.insertBefore(el, refNode) : container.appendChild(el)
}

/*
* @desc: 挂载文本
* @param: vnode 虚拟DOM对象
* @param: container 容器
*/
function mountText(vnode, container) {
	// children 是文字内容
	const { children } = vnode
	// 创建文本节点
	const el = document.createTextNode(children)
	// 把节点挂载到vnode上，方便后续访问
	vnode.el = el
	container.appendChild(el)
}


/*
* @desc: 元素属性，对比，赋值； class style key...
* @param: el 当前元素
* @param: attr class/style/key
* @param: preValue 旧的属性
* @param: nextValue 新的属性
*/
function patchData(el, attr, prevValue, nextValue) {
	switch(attr) {
		case 'style':
			// 新的样式
			for (let k in nextValue) {
				el.style[k] = nextValue[k]
			}
			// 旧的样式
			for (let k in prevValue) {
				// 如果旧的样式，在新的样式里找不到，意味着，删除
				if (!nextValue.hasOwnProperty(k)) {
					el.style[k] = ''
				}
			}
			break;
		case 'class':
			el.className = nextValue
			break;
		default: 
			if (attr[0] === '@') {

				// 移除之前的事件
				prevValue && typeof prevValue === 'function ' && el.removeEventListener(attr.slice(1), prevValue)

				// 事件
				// 事件名attr.slice(1): click
				// 函数 () => null : nextValue
				nextValue && typeof nextValue === 'function' && el.addEventListener(attr.slice(1), nextValue)
			} else {
				// attr
				el.setAttribute(attr, nextValue)
			}
		break;
	}
}


/*
* @desc 对比新旧虚拟DOM，算出最优值并挂载
* @param: prevVNode 旧虚拟DOM对象
* @param: nextVNode 新虚拟DOM对象
* @param: container 容器
*/
function patch(prevVNode, nextVNode, container) {
	const prevFlags = prevVNode.flags
	const nextFlags = nextVNode.flags
	if (prevFlags !== nextFlags) {
		// 一个html 一个text
		// 直接替换
		replaceVNode(prevVNode, nextVNode, container)
	} else {
		if (nextFlags === VNodeType.HTML) {
			// 如果2虚拟DOM, 都是html
			patchElement(prevVNode, nextVNode, container)
		} else if (nextFlags === VNodeType.TEXT) {
			// 如果2虚拟DOM, 都是文本
			patchText(prevVNode, nextVNode)
		}
	}
}



/*
* @desc: 把addVNode虚拟DOM，替换deleteVNode虚拟DOM
*/
function replaceVNode(deleteVNode, addVNode, container) {
	// 把之前的节点，移除
	container.removeChild(deleteVNode.el)
	// 把addVNode挂载进去
	mount(addVNode, container)
}


/*
* @desc: 2虚拟DOM， 对比更新， 都是文本节点
*/
function patchText(prevVNode, nextVNode) {
	// 找到文本节点
	const el = prevVNode.el
	nextVNode.el = el
	// 如果文本内容不一样
	if (prevVNode.children !== nextVNode.children) {
		// 更新
		el.nodeValue = nextVNode.children
	}
}



/*
* @desc: 新旧虚拟DOM，对比，都是HTML标签类型
*/
function patchElement(prevVNode, nextVNode, container) {
	// 如果换了不同的标签，更换
	if (prevVNode.tag !== nextVNode.tag) {
		replaceVNode(prevVNode, nextVNode, container)
		return
	}

	// 下面的逻辑是针对，新旧虚拟DOM，标签一样的
	// 1. 处理data属性的对比更新
	// 2. 对比虚拟DOM的children，找到要更新的


	// 1.  1) 如果新虚拟DOM，有data，把它追加到el上去；  2） 如果旧虚拟DOM的data, 在新虚拟DOM已经找不到了，删掉
	const el = prevVNode.el
	nextVNode.el = el
	const nextData = nextVNode.data
	const prevData = prevVNode.data
	if (nextData) {
		for (let k in nextData) {
			const prevValue = prevData[k]
			const nextValue = nextData[k] 
			patchData(el, k, prevValue, nextValue)
		}
	}
	// 删除
	if (prevData) {
		for (let key in prevData) {
			const prevValue = prevData[key]
			if (prevValue && !nextData.hasOwnProperty(key)) {
				patchData(el, key, prevValue, null)
			}
		}
	}

	// 2.
	patchChildren(
		prevChildFlags,
		nextChildFlags,
		prevChildren,
		nextChildren,
		container
	)
}

/*
* @desc: 新旧虚拟DOM的子虚拟DOM们，进行递归对比，挂载
*/
function patchChildren(
	prevChildFlags,
  nextChildFlags,
  prevChildren,
	nextChildren,
	container
) {
	switch(prevChildFlags) {
		case ChildType.SINGLE:
			// 如果旧虚拟DOM, 子虚拟DOM是单个子节点
			switch(nextChildFlags) {
				case ChildType.SINGLE:
					// 如果新虚拟DOM， 子虚拟DOM也是单个子节点, 直接递归对比，万事
					patch(prevChildren, nextChildren, container)
					break;
				case ChildType.EMPTY:
					// 如果新虚拟DOM, 子虚拟DOM是空， 删掉即可
					container.removeChild(prevChildren.el)
					break;
				default: 
					// 如果新虚拟DOM，子虚拟DOM是多个， 先把位置腾出来，把多个塞进去
					container.removeChild(prevChildren.el)
					nextChildren.forEach(nc => {
						mount(nc, container)
					})
					break;
			}
			break;
		case ChildType.EMPTY:
			// 如果旧虚拟DOM， 子虚拟DOM是空
			switch(nextChildFlags){
				case ChildType.SINGLE:
					// 如果新虚拟DOM, 子虚拟DOM是单个子节点
					mount(nextChildren, container)
					break;
				case ChildType.EMPTY:
					// 如果新虚拟DOM, 子虚拟DOM也是空， 啥也不用干
					break;
				default:
					// 如果新虚拟DOM, 子虚拟DOM多个，塞进去
					nextChildren.forEach(nc => {
						mount(nc, container)
					})
					break;
			}
			break;
		default:
			// 如果旧虚拟DOM, 子虚拟DOM是多个
			switch(nextChildFlags) {
				case ChildType.SINGLE:
					// 如果新虚拟DOM，子虚拟DOM是单个
					prevChildren.forEach(pc => {
						container.removeChild(pc.el)
					})
					mount(nextChildren, container)
					break;
				case ChildType.EMPTY:
					// 如果新虚拟DOM，子虚拟DOM是空
					prevChildren.forEach(pc => {
						container.removeChild(pc.el)
					})
					break;
				default: 
					// 如果新虚拟DOM，子虚拟DOM也是多个
					// 遍历新的子虚拟DOM们, 再看旧的子虚拟DOM们， 找到key一样的，记录它在旧子虚拟DOM里的位置lastIndex
					// 如果说依次找到的它们后，位置是递增的(多个 lastIndex)，意味着它们相对位置是没问题的，不用动
					// 分析 https://blog.csdn.net/c_kite/article/details/80428411
					let lastIndex = 0
          for (let i = 0; i < nextChildren.length; i++) {
            const nextVNode = nextChildren[i]
            let j = 0,
              find = false
            for (j; j < prevChildren.length; j++) {
              const prevVNode = prevChildren[j]
              if (nextVNode.key === prevVNode.key) {
                find = true
                patch(prevVNode, nextVNode, container)
                if (j < lastIndex) {
                  // 需要移动
                  const refNode = nextChildren[i - 1].el.nextSibling
                  container.insertBefore(prevVNode.el, refNode)
                  break
                } else {
                  // 更新 lastIndex
                  lastIndex = j
                }
              }
            }
            if (!find) {
              // 挂载新节点
              const refNode =
                i - 1 < 0
                  ? prevChildren[0].el
                  : nextChildren[i - 1].el.nextSibling

              mount(nextVNode, container, refNode)
            }
					}
					// 移除已经不存在的节点
          for (let i = 0; i < prevChildren.length; i++) {
            const prevVNode = prevChildren[i]
            const has = nextChildren.find(
              nextVNode => nextVNode.key === prevVNode.key
            )
            if (!has) {
              // 移除
              container.removeChild(prevVNode.el)
            }
          }
					break;
			}
			break;
	}
}


