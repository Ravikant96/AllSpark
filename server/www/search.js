const API = require('../utils/api');
const users = require('./users').list;
const dashboards = require('./dashboards').list;
const reports = require('./reports/report').list;
const connections = require('./credentials').list;

exports.query = class extends API {

	async query() {

		Object.assign(this.request.body, this.request.query);

		let
			search_map = new Map(),
			search_items = [],
			response = [];

		search_map.set("users", users);
		search_map.set("dashboards", dashboards);
		search_map.set("reports", reports);
		// search_map.set("visualizations", reports);
		search_map.set("connections", connections);

		search_items = this.request.query.search != 'global' ? [search_map.get(this.request.query.search)] : search_map.values();

		for(const item of search_items) {

			const obj = Object.assign(new item(), this);
			let list;

			try {
				list = await obj.list();
			}
			catch (e) {
				list = [];
			}

			response = response.concat(list);
		}

		return response;
	}
}