'use strict';
'require view';
'require uci';
'require rpc';

/*
 * FilesCodeBox LuCI 入口页(luci-app-filescodebox 视图)。
 *
 * 为什么是"状态 + 新窗口打开"而非 iframe 内嵌:core 安全基线对全部响应下发
 * X-Frame-Options: SAMEORIGIN(防点击劫持),LuCI(源 :80)内嵌业务端口(:12345)
 * 属跨源,浏览器必拦(白屏)。故本页只做:服务状态展示 + 大按钮新窗口打开 UI。
 */

var callInitList = rpc.declare({
	object: 'luci',
	method: 'getInitList',
	params: ['name'],
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('filescodebox'),
			L.resolveDefault(callInitList('filescodebox'), {})
		]);
	},

	render: function(results) {
		var port = uci.get('filescodebox', 'main', 'port') || '12345';
		var dataDir = uci.get('filescodebox', 'main', 'data_dir') || '/etc/filescodebox/data';
		var url = 'http://' + window.location.hostname + ':' + port + '/';

		var svc = (results[1] || {})['filescodebox'];
		var running = !!(svc && svc.running);

		var badge = running
			? E('span', { 'class': 'label label-success' }, _('运行中'))
			: E('span', { 'class': 'label label-important' }, _('未运行'));

		var statusTable = E('table', { 'class': 'table' }, [
			E('tr', {}, [
				E('td', { 'style': 'width:33%' }, _('服务状态')),
				E('td', {}, [badge])
			]),
			E('tr', {}, [
				E('td', {}, _('访问端口')),
				E('td', {}, [port])
			]),
			E('tr', {}, [
				E('td', {}, _('数据目录')),
				E('td', {}, [dataDir])
			]),
			E('tr', {}, [
				E('td', {}, _('管理入口')),
				E('td', {}, [url])
			])
		]);

		var openBtn = running
			? E('a', {
				'class': 'btn cbi-button cbi-button-apply',
				'href': url,
				'target': '_blank',
				'rel': 'noopener'
			}, [ _('打开 FilesCodeBox 界面 ↗') ])
			: E('span', { 'class': 'btn cbi-button cbi-button-negative', 'disabled': 'disabled' },
				[ _('服务未运行,请先在终端执行: /etc/init.d/filescodebox start') ]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('FilesCodeBox 文件快递柜')),
			E('div', { 'class': 'cbi-map-descr' },
				_('匿名口令分享文本/文件——网页与 API 同端口 %s。').format(port)),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' }, _('服务')),
				statusTable,
				E('div', { 'class': 'cbi-page-actions' }, [openBtn])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' }, _('提示')),
				E('div', { 'class': 'cbi-value' },
					_('默认管理员 admin / admin123,装完请尽快在网页设置里修改。')),
				E('div', { 'class': 'cbi-value' },
					_('配置在 /etc/config/filescodebox(UCI),改完执行 /etc/init.d/filescodebox reload。')),
				E('div', { 'class': 'cbi-value' },
					_('上传文件与数据库存于数据目录,大容量场景建议指到数据盘。'))
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
