/*
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for
 * the specific language governing permissions and limitations under the License.
 */
import http from '@services/http';
import RedisClusterNodeByIpModel from '@services/model/redis/redis-cluster-node-by-ip';
import RedisHostModel from '@services/model/redis/redis-host';

const getRootPath = () => `/apis/redis/bizs/${window.PROJECT_CONFIG.BIZ_ID}/toolbox`;

interface MasterSlaveByIp {
  cluster: {
    bk_cloud_id: number;
    cluster_type: string;
    deploy_plan_id: number;
    id: number;
    immute_domain: string;
    major_version: string;
    name: string;
    region: string;
  };
  instances: {
    bk_biz_id: number;
    bk_cloud_id: number;
    bk_host_id: number;
    bk_instance_id: number;
    instance: string;
    ip: string;
    name: string;
    phase: string;
    port: number;
    status: string;
  }[];
  master_ip: string;
  slave_ip: string;
}

/**
 * 根据IP查询集群、角色和规格
 */
export function queryInfoByIp(params: { ips: string[] }) {
  return http
    .post<RedisClusterNodeByIpModel[]>(`${getRootPath()}/query_by_ip/`, params)
    .then((data) => data.map((item) => new RedisClusterNodeByIpModel(item)));
}

/**
 * 查询集群下的主机列表
 */
export function queryClusterHostList(params: { cluster_id?: number; ip?: string }) {
  return http
    .post<RedisHostModel[]>(`${getRootPath()}/query_cluster_ips/`, params)
    .then((data) => data.map((item) => new RedisHostModel(item)));
}

/**
 * 根据masterIP查询集群、实例和slave
 */
export function queryMasterSlaveByIp(params: { ips: string[] }) {
  return http.post<MasterSlaveByIp[]>(`${getRootPath()}/query_master_slave_by_ip/`, params);
}

/**
 * 根据cluster_id查询主从关系对
 */
export function queryMasterSlavePairs(params: { cluster_id: number }) {
  return http.post<
    {
      master_ip: string;
      slave_ip: string;
    }[]
  >(`${getRootPath()}/query_master_slave_pairs/`, params);
}

// 查询集群下的主机列表
export const getRedisHostList = async (obj: {
  bk_biz_id: number;
  role?: string;
  cluster_id?: number;
  instance_address?: string;
}) => {
  const params = {
    ip: obj.instance_address,
    cluster_id: obj.cluster_id,
    role: obj.role,
  };
  if (!obj.instance_address) {
    delete params.ip;
  }
  if (!obj.role) {
    delete params.role;
  }
  return http
    .post<RedisHostModel[]>(`/apis/redis/bizs/${obj.bk_biz_id}/toolbox/query_cluster_ips/`, params)
    .then((data) => {
      const filterArr = data.map((item) => new RedisHostModel(item)).filter((item) => item.isMaster);
      const count = filterArr.length;
      return {
        count,
        results: filterArr,
      };
    });
};
