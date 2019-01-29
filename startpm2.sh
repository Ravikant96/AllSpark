#!/bin/bash
environment="$1"
dbhost=`echo $MYSQLHOST`
dbuser=`echo $MYSQLUSER`
dbpass=`echo $MYSQLPASS`

cd /apps/node-apps/allspark/
cp config/sample.json config/$environment.json
sed -i "s|8080|3001|g" config/$environment.json
sed -i "s|mysql-host|$dbhost|g" config/$environment.json
sed -i "s|mysql-read|$dbuser|g" config/$environment.json
sed -i "s|mysql-write|$dbuser|g" config/$environment.json
sed -i "s|mysql-pass|$dbpass|g" config/$environment.json
sed -i "s|env-db|"$environment"_allspark|g" config/$environment.json
NODE_ENV="$environment" pm2 start bin/www --name "$environment"

sleep 20
curl http://localhost:3001/api/v2/setup/run
pm2 restart all

cd /apps/node-apps/allspark/
screen -dm bash -c 'python3 main.py'
pm2 logs
