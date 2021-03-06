const mysql = require('./mysql').MySQL;
const fs = require('fs');
const commonFun = require('./commonFunctions');
const config = require("config");
const path = require("path");

let gcloud = null;

try {
	gcloud = require('google-cloud');
} catch (e) {
}

const gauth = function (project, file) {

	console.log('Initiating authentication with gcloud..');

	return gcloud.bigquery({
		projectId: project,
		keyFilename: file
	});

};

class BigQuery {

	static call(query, filters, account, file, project, legacySQL = false) {

		return new Promise(function (resolve, reject) {

			const options = {
				"query": query,
				"useLegacySql": legacySQL,
			};

			if (!legacySQL) {

				options.queryParameters = filters;
				options.parameterMode = "NAMED";
			}

			gauth(project, path.join(__dirname, "../../bigquery_files/" + account + "/" + file)).query(options, function (err, bqData) {

				if (err) {
					console.log("in error ", err);
					return reject(err);
				}

				resolve(bqData);
			});
		});
	}


	static async setup() {

		if (!config.has("bigquery_files_destination")) {

			return;
		}

		const bigQueryConnections = await mysql.query(`
            select
                c.*,
                a.account_id
            from
                tb_credentials c
            join
                tb_accounts a
                using(account_id)
            where
                type in ('bigquery', 'bigquery_legacy')
                and c.status = 1
                and a.status = 1
            `);

		const path = config.get("bigquery_files_destination");

		for (const con of bigQueryConnections) {

			if (!fs.existsSync(path + con.account_id)) {

				fs.mkdirSync(path + con.account_id);
			}

			else {

				try {

					await commonFun.clearDirectory(path + con.account_id);
				}
				catch (e) {

					console.log(new Error('could not clear directory', e));
				}
			}
		}

		for (const con of bigQueryConnections) {

			try {

				await fs.writeFileSync(path + con.account_id + '/' + con.id + ".json", con.file);
			}
			catch (e) {

				console.log(new Error('could not load bigquery file: ', con.id, 'for ', con.name));
			}
		}
	}
}

exports.setup = BigQuery.setup;
exports.BigQuery = BigQuery;