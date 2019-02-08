const mysql = require('./mysql').MySQL;

let oracledb = null;

try {
	oracledb = require('oracledb');
} catch(e) {
	oracledb = 1;
}

oracledb.poolTimeout = 0;
oracledb.Promise = Promise;
oracledb.outFormat = 4002 //object format, default is array format;

const poolObj = {};


class Oracle {

	static async crateExternalPool(id = -1) {

		const query = `select * from tb_credentials c where c.status = 1 and type = 'oracle'`;

		const credentials = await mysql.query(query);

		for (const credential of credentials) {

			poolObj[credential.id] =
				{
					credential: {
						user: credential.user,
						password: credential.password,
						connectString: `(DESCRIPTION =(ADDRESS = (PROTOCOL = TCP)(HOST = ${credential.host})(PORT = ${credential.port || 1521}))(CONNECT_DATA =(SID= ${credential.name})))`,
					}
				};

		}
		console.log("Oracle Connections Available: ", Object.keys(poolObj));
	}

	//lazy load pool

	async query(sql, values = {}, connectionName) {

		if (!poolObj[connectionName].credential) {

			throw new Error("connection " + connectionName + "does not exist");
		}

		if (!poolObj[connectionName].pool) {

			poolObj[connectionName].pool = await oracledb.createPool(poolObj[connectionName].credential);
		}

		this.pool = poolObj[connectionName].pool;
		let result;
		let replacedSql = sql;

		for (const key in values) {

			replacedSql = replacedSql.replace((new RegExp(key, "g")), values[key]);
		}

		try {

			let connection = await this.pool.getConnection();

			result = await connection.execute(sql, values);
		}
		catch (err) {

			throw(err);
		}

		this.sql = replacedSql;
		this.originalSql = sql;
		result = result.rows;
		result.instance = this;

		return result;
	}

	async schema(id) {

		if (!poolObj[id].credential) {

			throw new Error("connection " + id + "does not exist");
		}

		if (!poolObj[id].pool) {

			poolObj[id].pool = await oracledb.createPool(poolObj[id].credential);
		}

		this.pool = poolObj[id].pool;

		const columns = await this.query("select table_name as table_name, column_name as column_name, data_type as data_type from user_tab_cols", {}, id);

		const result = [{
			name: "database",
		}];

		const tables = {};

		for (const col of columns) {

			if (!tables.hasOwnProperty(col.TABLE_NAME)) {

				tables[col.TABLE_NAME] = {
					name: col.TABLE_NAME,
					columns: []
				};
			}

			tables[col.TABLE_NAME].columns.push({
				name: col.COLUMN_NAME,
				type: col.DATA_TYPE
			})
		}

		result[0].tables = Object.values(tables);

		return result;
	}
}

exports.Oracle = (() => new Oracle)();
exports.crateExternalPool = Oracle.crateExternalPool;