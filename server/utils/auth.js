const mysql = require('./mysql').MySQL;
const commonFun = require("./commonFunctions");
const config = require("config");

class Authenticate {

	static async report(reportObject, userJWTObject) {

		if (config.has("role_ignore") && config.has("privilege_ignore")) {

			if (config.get("role_ignore") && config.get("privilege_ignore")) {

				return true;
			}
		}

		const accountId = userJWTObject.account_id;

		if (parseInt(reportObject) || !reportObject) {

			reportObject = await mysql.query(`
                SELECT
                  q.*,
                  IF(user_id IS NULL AND d.query_id is null, 0, 1) AS flag
                FROM
                    tb_query q
                JOIN
          			(
                		SELECT
                			query_id
                		FROM
                			tb_visualization_dashboard vd
                		JOIN
                			tb_user_dashboard ud
                			USING(dashboard_id)
                		JOIN
                			tb_query_visualizations qv
                			USING(visualization_id)
                		WHERE
                			user_id = ?
                			AND query_id = ?
                		UNION ALL
                		SELECT
                			NULL AS query_id
                		LIMIT 1
                	) d
                LEFT JOIN
                     tb_user_query uq ON
                     uq.query_id = q.query_id
                     AND user_id = ?
                WHERE
                    q.query_id = ?
                    AND is_enabled = 1
                    AND is_deleted = 0
                    AND account_id = ?
                `,
				[userJWTObject.user_id, reportObject, userJWTObject.user_id, reportObject, accountId]);

			if (!reportObject.length && reportObject.length > 1) {

				return {
					error: true,
					message: "error in query details",
				}
			}

			reportObject = reportObject[0];
		}

		if (reportObject.flag) {

			return {
				error: false,
				message: "individual access",
			}
		}

		const userPrivileges = [];

		userJWTObject.roles && userJWTObject.roles.map(x => {
			userPrivileges.push([accountId, x.category_id, x.role]);
		});

		let objectPrivileges = [[reportObject.account_id], [reportObject.category_id]];

		objectPrivileges[2] = reportObject.roles ? reportObject.roles.split(',').map(x => parseInt(x)) : [null];

		objectPrivileges = commonFun.listOfArrayToMatrix(objectPrivileges);

		return commonFun.authenticatePrivileges(userPrivileges, objectPrivileges);
	}

	static async dashboard(dashboardQueryList, userObj) {

		if (parseInt(dashboardQueryList) || !dashboardQueryList) {

			dashboardQueryList = await mysql.query(`
				 SELECT
					q.*,
					coalesce(user_id, 0)  AS flag,
					d.visibility as visibility
                FROM
                    tb_query q
                JOIN
                	(
                		SELECT
                			d.id AS dashboard, d.visibility
                		FROM
                			tb_dashboards d
                		JOIN
                			tb_user_dashboard ud
                		ON
                			d.id = ud.dashboard_id
                		WHERE
                			ud.user_id = ?
                			AND d.id = ?
                		GROUP BY
                			dashboard
                		UNION ALL
                		select
                			NULL AS dashboard,
                			NULL AS visibility
                		LIMIT 1
                		
                	) d

                LEFT JOIN
                     tb_user_query uq
                ON
                     uq.query_id = q.query_id
                     AND user_id = ?
                WHERE
                	d.dashboard = ?
                    AND q.query_id IN (
                    	SELECT
                    		qv.query_id
                    	FROM
                    		tb_visualization_dashboard vd
                    	JOIN
                    		tb_query_visualizations qv
                    		using(visualization_id)
                    	WHERE
                    		dashboard_id = ?
                    )
                    AND is_enabled = 1
                    AND is_deleted = 0
                    AND account_id = ?
			`,
				[userObj.user_id, dashboardQueryList, userObj.user_id,
					dashboardQueryList, dashboardQueryList, userObj.account_id
				]
			);
		}


		for (const query of dashboardQueryList) {

			if (query.visibility) {

				return {
					error: false,
					message: "private dashboard to user"
				}
			}

			const authResponse = await Authenticate.report(query, userObj);

			if (authResponse.error) {

				return {
					error: true,
					message: "not authenticated for Report id:" + query.query_id
				}
			}
		}

		return {
			error: false,
			message: "public dashboard and privileged user",
		}
	}
}

module.exports = Authenticate;