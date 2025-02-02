# -*- coding: utf-8 -*-
"""
TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
You may obtain a copy of the License at https://opensource.org/licenses/MIT
Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
"""
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers

from backend.db_meta.enums import ClusterType
from backend.db_meta.models import AppCache, Cluster
from backend.flow.engine.controller.tendbsingle import TenDBSingleController
from backend.ticket import builders
from backend.ticket.builders.mysql.base import BaseMySQLTicketFlowBuilder, MySQLBaseOperateDetailSerializer
from backend.ticket.constants import FlowRetryType, TicketType


class TenDBSingleStandardizeDetailSerializer(MySQLBaseOperateDetailSerializer):
    class InnerDetailSerializer(serializers.Serializer):
        cluster_ids = serializers.ListField(help_text=_("集群ID列表"))

    bk_biz_id = serializers.IntegerField(help_text=_("业务ID"))
    infos = InnerDetailSerializer(help_text=_("标准化信息"))

    def validate(self, attrs):
        self.__validate_clusters(attrs=attrs)
        return attrs

    @staticmethod
    def __validate_clusters(attrs):
        app_obj = AppCache.objects.get(bk_biz_id=attrs["bk_biz_id"])

        for cluster_obj in Cluster.objects.filter(pk__in=attrs["infos"]["cluster_ids"]).all():
            if cluster_obj.bk_biz_id != attrs["bk_biz_id"]:
                raise serializers.ValidationError(
                    _("{} 不是 [{}]{} 的集群".format(cluster_obj.immute_domain, app_obj.bk_biz_id, app_obj.db_app_abbr))
                )

            if cluster_obj.cluster_type != ClusterType.TenDBSingle.value:
                raise serializers.ValidationError(
                    _("{} 不是 {} 集群".format(cluster_obj.immute_domain, ClusterType.TenDBSingle.value))
                )


class TenDBSingleStandardizeFlowParamBuilder(builders.FlowParamBuilder):
    controller = TenDBSingleController.standardize_scene


@builders.BuilderFactory.register(TicketType.TENDBSINGLE_STANDARDIZE)
class TenDBSingleStandardizeFlowBuilder(BaseMySQLTicketFlowBuilder):
    serializer = TenDBSingleStandardizeDetailSerializer
    inner_flow_builder = TenDBSingleStandardizeFlowParamBuilder
    inner_flow_name = _("TenDB Single 标准化")
    retry_type = FlowRetryType.MANUAL_RETRY
