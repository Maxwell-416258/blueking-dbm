<!--
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License athttps://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for
 * the specific language governing permissions and limitations under the License.
-->

<template>
  <div class="mysql-single-cluster-list-page">
    <div class="operation-box">
      <AuthButton
        action-id="mysql_apply"
        theme="primary"
        @click="handleApply">
        {{ t('实例申请') }}
      </AuthButton>
      <span
        v-bk-tooltips="{
          disabled: hasSelected,
          content: t('请选择集群'),
        }"
        class="inline-block">
        <BkButton
          class="ml-8"
          :disabled="!hasSelected"
          @click="handleShowAuthorize(state.selected)">
          {{ t('批量授权') }}
        </BkButton>
      </span>
      <BkButton
        class="ml-8"
        @click="handleShowExcelAuthorize">
        {{ t('导入授权') }}
      </BkButton>
      <DropdownExportExcel
        :ids="selectedIds"
        type="tendbsingle" />
      <DbSearchSelect
        :data="searchSelectData"
        :get-menu-list="getMenuList"
        :model-value="searchValue"
        :placeholder="t('请输入或选择条件搜索')"
        unique-select
        @change="handleSearchValueChange" />
    </div>
    <div
      class="table-wrapper"
      :class="{ 'is-shrink-table': isStretchLayoutOpen }">
      <DbTable
        ref="tableRef"
        :columns="columns"
        :data-source="getTendbsingleList"
        releate-url-query
        :row-class="setRowClass"
        selectable
        :settings="settings"
        @clear-search="clearSearchValue"
        @column-filter="columnFilterChange"
        @column-sort="columnSortChange"
        @selection="handleSelection"
        @setting-change="updateTableSettings" />
    </div>
  </div>
  <!-- 集群授权 -->
  <ClusterAuthorize
    v-model="authorizeState.isShow"
    :account-type="AccountTypes.MYSQL"
    :cluster-types="[ClusterTypes.TENDBSINGLE]"
    :selected="authorizeState.selected"
    @success="handleClearSelected" />
  <!-- excel 导入授权 -->
  <ExcelAuthorize
    v-model:is-show="isShowExcelAuthorize"
    :cluster-type="ClusterTypes.TENDBSINGLE" />
  <EditEntryConfig
    :id="clusterId"
    v-model:is-show="showEditEntryConfig"
    :get-detail-info="getTendbsingleDetail" />
</template>

<script setup lang="tsx">
  import { useI18n } from 'vue-i18n';
  import {
    useRoute,
    useRouter,
  } from 'vue-router';

  import TendbsingleModel from '@services/model/mysql/tendbsingle';
  import {
    getTendbsingleDetail,
    getTendbsingleInstanceList,
    getTendbsingleList,
  } from '@services/source/tendbsingle';
  import { createTicket } from '@services/source/ticket';
  import { getUserList } from '@services/source/user';

  import {
    useCopy,
    useInfoWithIcon,
    useLinkQueryColumnSerach,
    useStretchLayout,
    useTableSettings,
    useTicketMessage
  } from '@hooks';

  import {
    useGlobalBizs,
  } from '@stores';

  import {
    AccountTypes,
    ClusterTypes,
    TicketTypes,
    type TicketTypesStrings,
    UserPersonalSettings,
  } from '@common/const';

  import ClusterAuthorize from '@components/cluster-authorize/ClusterAuthorize.vue';
  import ExcelAuthorize from '@components/cluster-common/ExcelAuthorize.vue';
  import OperationBtnStatusTips from '@components/cluster-common/OperationBtnStatusTips.vue';
  import RenderOperationTag from '@components/cluster-common/RenderOperationTag.vue';
  import EditEntryConfig from '@components/cluster-entry-config/Index.vue';
  import DbStatus from '@components/db-status/index.vue';
  import DropdownExportExcel from '@components/dropdown-export-excel/index.vue';
  import RenderInstances from '@components/render-instances/RenderInstances.vue';
  import TextOverflowLayout from '@components/text-overflow-layout/Index.vue';

  import {
    getMenuListSearch,
    getSearchSelectorParams,
    isRecentDays,
  } from '@utils';

  import type {
    SearchSelectData,
    SearchSelectItem,
  } from '@/types/bkui-vue';

  interface ColumnData {
    cell: string,
    data: TendbsingleModel
  }

  interface State {
    selected: Array<TendbsingleModel>,
  }

  const clusterId = defineModel<number>('clusterId');

  const router = useRouter();
  const route = useRoute();
  const globalBizsStore = useGlobalBizs();
  const copy = useCopy();
  const { t, locale } = useI18n();
  const ticketMessage = useTicketMessage();
  const {
    isOpen: isStretchLayoutOpen,
    splitScreen: stretchLayoutSplitScreen,
  } = useStretchLayout();

  const {
    columnAttrs,
    searchAttrs,
    searchValue,
    sortValue,
    columnCheckedMap,
    batchSearchIpInatanceList,
    columnFilterChange,
    columnSortChange,
    clearSearchValue,
    handleSearchValueChange,
  } = useLinkQueryColumnSerach(ClusterTypes.TENDBSINGLE, [
    'bk_cloud_id',
    'db_module_id',
    'major_version',
    'region',
    'time_zone',
  ], () => fetchData());

  const tableRef = ref();
  const isShowExcelAuthorize = ref(false);
  const showEditEntryConfig = ref(false);

  const authorizeState = reactive({
    isShow: false,
    selected: [] as TendbsingleModel[],
  });

  const state = reactive<State>({
    selected: [],
  });

  const isCN = computed(() => locale.value === 'zh-cn');
  const hasSelected = computed(() => state.selected.length > 0);
  const selectedIds = computed(() => state.selected.map(item => item.id));
  const searchSelectData = computed(() => [
    {
      name: t('IP 或 IP:Port'),
      id: 'instance',
    },
    {
      name: t('访问入口'),
      id: 'domain',
    },
    {
      name: 'ID',
      id: 'id',
    },
    {
      name: t('集群名称'),
      id: 'name',
    },
    {
      name: t('管控区域'),
      id: 'bk_cloud_id',
      multiple: true,
      children: searchAttrs.value.bk_cloud_id,
    },
    {
      name: t('状态'),
      id: 'status',
      multiple: true,
      children: [
        {
          id: 'normal',
          name: t('正常'),
        },
        {
          id: 'abnormal',
          name: t('异常'),
        },
      ],
    },
    {
      name: t('模块'),
      id: 'db_module_id',
      multiple: true,
      children: searchAttrs.value.db_module_id,
    },
    {
      name: t('版本'),
      id: 'major_version',
      multiple: true,
      children: searchAttrs.value.major_version,
    },
    {
      name: t('地域'),
      id: 'region',
      multiple: true,
      children: searchAttrs.value.region,
    },
    {
      name: t('创建人'),
      id: 'creator',
    },
    {
      name: t('时区'),
      id: 'time_zone',
      multiple: true,
      children: searchAttrs.value.time_zone,
    },
  ]);

  const tableOperationWidth = computed(() => {
    if (!isStretchLayoutOpen.value) {
      return isCN.value ? 160 : 200;
    }
    return 60;
  });

  const columns = computed(() => [
    {
      label: 'ID',
      field: 'id',
      fixed: 'left',
      width: 100,
    },
    {
      label: t('访问入口'),
      field: 'master_domain',
      fixed: 'left',
      width: 300,
      minWidth: 300,
      render: ({ data }: ColumnData) => (
        <TextOverflowLayout>
          {{
            default: () => (
              <auth-button
                action-id="mysql_view"
                resource={data.id}
                permission={data.permission.mysql_view}
                text
                theme="primary"
                onClick={() => handleToDetails(data.id)}>
                {data.masterDomainDisplayName}
              </auth-button>
            ),
            append: () => (
              <>
                <db-icon
                  v-bk-tooltips={t('复制主访问入口')}
                  type="copy"
                  onClick={() => copy(data.masterDomainDisplayName)} />
                <auth-button
                  v-bk-tooltips={t('修改入口配置')}
                  action-id="access_entry_edit"
                  resource="mysql"
                  permission={data.permission.access_entry_edit}
                  text
                  theme="primary"
                  onClick={() => handleOpenEntryConfig(data)}>
                  <db-icon type="edit" />
                </auth-button>
              </>
            ),
          }}
        </TextOverflowLayout>
      ),
    },
    {
      label: t('集群名称'),
      field: 'cluster_name',
      minWidth: 200,
      fixed: 'left',
      showOverflowTooltip: false,
      render: ({ data }: ColumnData) => (
        <TextOverflowLayout>
          {{
            default: () => data.cluster_name,
            append: () => (
              <>
                {
                  data.operationTagTips.map(item => <RenderOperationTag class="cluster-tag ml-4" data={item}/>)
                }
                {
                  data.isOffline && !data.isStarting && (
                    <db-icon
                      svg
                      type="yijinyong"
                      class="cluster-tag"
                      style="width: 38px; height: 16px;" />
                  )
                }
                {
                  isRecentDays(data.create_at, 24 * 3) && (
                    <span
                      class="glob-new-tag cluster-tag ml-4"
                      data-text="NEW" />
                  )
                }
                <db-icon
                  v-bk-tooltips={t('复制集群名称')}
                  type="copy"
                  onClick={() => copy(data.cluster_name)} />
              </>
            ),
          }}
        </TextOverflowLayout>
      ),
    },
    {
      label: t('管控区域'),
      field: 'bk_cloud_name',
      filter: {
        list: columnAttrs.value.bk_cloud_id,
        checked: columnCheckedMap.value.bk_cloud_id,
      },
    },
    {
      label: t('状态'),
      field: 'status',
      minWidth: 100,
      filter: {
        list: [
          {
            value: 'normal',
            text: t('正常'),
          },
          {
            value: 'abnormal',
            text: t('异常'),
          },
        ],
        checked: columnCheckedMap.value.status,
      },
      render: ({ data }: ColumnData) => {
        const info = data.status === 'normal' ? { theme: 'success', text: t('正常') } : { theme: 'danger', text: t('异常') };
        return <DbStatus theme={info.theme}>{info.text}</DbStatus>;
      },
    },
    {
      label: t('实例'),
      field: 'masters',
      width: 180,
      minWidth: 180,
      showOverflowTooltip: false,
      render: ({ data }: ColumnData) => (
      <RenderInstances
        highlightIps={batchSearchIpInatanceList.value}
        data={data.masters}
        title={t('【inst】实例预览', { inst: data.master_domain })}
        role="orphan"
        clusterId={data.id}
        dataSource={getTendbsingleInstanceList}
      />
    ),
    },
    {
      label: t('所属DB模块'),
      field: 'db_module_id',
      width: 140,
      showOverflowTooltip: true,
      filter: {
        list: columnAttrs.value.db_module_id,
        checked: columnCheckedMap.value.db_module_id,
      },
      render: ({ data }: ColumnData) => <span>{data.db_module_name || '--'}</span>,
    },
    {
      label: t('版本'),
      field: 'major_version',
      minWidth: 100,
      filter: {
        list: columnAttrs.value.major_version,
        checked: columnCheckedMap.value.major_version,
      },
      render: ({ cell }: ColumnData) => <span>{cell || '--'}</span>,
    },
    {
      label: t('地域'),
      field: 'region',
      minWidth: 100,
      filter: {
        list: columnAttrs.value.region,
        checked: columnCheckedMap.value.region,
      },
      render: ({ cell }: ColumnData) => <span>{cell || '--'}</span>,
    },
    {
      label: t('创建人'),
      field: 'creator',
      width: 140,
      render: ({ cell }: ColumnData) => <span>{cell || '--'}</span>,
    },
    {
      label: t('部署时间'),
      field: 'create_at',
      width: 160,
      sort: true,
      render: ({ data }: ColumnData) => <span>{data.createAtDisplay || '--'}</span>,
    },
    {
      label: t('时区'),
      field: 'cluster_time_zone',
      width: 100,
      filter: {
        list: columnAttrs.value.time_zone,
        checked: columnCheckedMap.value.time_zone,
      },
      render: ({ cell }: ColumnData) => <span>{cell || '--'}</span>,
    },
    {
      label: t('操作'),
      field: '',
      width: tableOperationWidth.value,
      fixed: isStretchLayoutOpen.value ? false : 'right',
      render: ({ data }: ColumnData) => (
        <>
          <bk-button
            text
            theme="primary"
            class="mr-8"
            onClick={() => handleShowAuthorize([data])}>
            { t('授权') }
          </bk-button>
          {
            data.isOnline ? (
              <OperationBtnStatusTips data={data}>
                <auth-button
                  text
                  theme="primary"
                  class="mr-8"
                  action-id="mysql_enable_disable"
                  permission={data.permission.mysql_enable_disable}
                  disabled={data.operationDisabled}
                  resource={data.id}
                  onClick={() => handleSwitchCluster(TicketTypes.MYSQL_SINGLE_DISABLE, data)}>
                  { t('禁用') }
                </auth-button>
              </OperationBtnStatusTips>
            ) : (
              <>
                <OperationBtnStatusTips data={data}>
                  <auth-button
                    text
                    theme="primary"
                    class="mr-8"
                    action-id="mysql_enable_disable"
                    permission={data.permission.mysql_enable_disable}
                    disabled={data.isStarting}
                    resource={data.id}
                    onClick={() => handleSwitchCluster(TicketTypes.MYSQL_SINGLE_ENABLE, data)}>
                    { t('启用') }
                  </auth-button>
                </OperationBtnStatusTips>
                <OperationBtnStatusTips data={data}>
                  <auth-button
                    text
                    theme="primary"
                    class="mr-8"
                    action-id="mysql_destroy"
                    permission={data.permission.mysql_destroy}
                    disabled={Boolean(data.operationTicketId)}
                    resource={data.id}
                    onClick={() => handleDeleteCluster(data)}>
                    { t('删除') }
                  </auth-button>
                </OperationBtnStatusTips>
              </>
            )
          }
        </>
      ),
    },
  ]);

  // 设置用户个人表头信息
  const disabledFields = ['master_domain'];
  const defaultSettings = {
    fields: (columns.value || []).filter(item => item.field).map(item => ({
      label: item.label as string,
      field: item.field as string,
      disabled: disabledFields.includes(item.field as string),
    })),
    checked: (columns.value || []).map(item => item.field).filter(key => !!key && key !== 'id') as string[],
    showLineHeight: false,
    trigger: 'manual' as const,
  };
  const {
    settings,
    updateTableSettings,
  } = useTableSettings(UserPersonalSettings.TENDBSINGLE_TABLE_SETTINGS, defaultSettings);

  const getMenuList = async (item: SearchSelectItem | undefined, keyword: string) => {
    if (item?.id !== 'creator' && keyword) {
      return getMenuListSearch(item, keyword, searchSelectData.value as SearchSelectData, searchValue.value);
    }

    // 没有选中过滤标签
    if (!item) {
      // 过滤掉已经选过的标签
      const selected = (searchValue.value || []).map(value => value.id);
      return searchSelectData.value.filter(item => !selected.includes(item.id));
    }

    // 远程加载执行人
    if (item.id === 'creator') {
      if (!keyword) {
        return [];
      }
      return getUserList({
        fuzzy_lookups: keyword,
      })
        .then(res => res.results.map(item => ({
          id: item.username,
          name: item.username,
        })));
    }

    // 不需要远层加载
    return searchSelectData.value.find(set => set.id === item.id)?.children || [];
  };

  const fetchData = () => {
    const params = getSearchSelectorParams(searchValue.value);
    tableRef.value.fetchData(params, { ...sortValue });
  };

  // 设置行样式
  const setRowClass = (row: TendbsingleModel) => {
    const classList = [row.isOffline ? 'is-offline' : ''];
    const newClass = isRecentDays(row.create_at, 24 * 3) ? 'is-new-row' : '';
    classList.push(newClass);
    if (row.id === clusterId.value) {
      classList.push('is-selected-row');
    }
    return classList.filter(cls => cls).join(' ');
  };

  /**
   * 申请实例
   */
  const handleApply = () => {
    router.push({
      name: 'SelfServiceApplySingle',
      query: {
        bizId: globalBizsStore.currentBizId,
        from: route.name as string,
      },
    });
  };

  /** 集群授权 */
  const handleShowAuthorize = (selected: TendbsingleModel[] = []) => {
    authorizeState.isShow = true;
    authorizeState.selected = selected;
  };
  const handleClearSelected = () => {
    state.selected = [];
    authorizeState.selected = [];
  };
  const handleShowExcelAuthorize = () => {
    isShowExcelAuthorize.value = true;
  };

  const handleOpenEntryConfig = (row: TendbsingleModel) => {
    showEditEntryConfig.value  = true;
    clusterId.value = row.id;
  };

  /**
   * 查看详情
   */
  const handleToDetails = (id: number) => {
    stretchLayoutSplitScreen();
    clusterId.value = id;
  };

  /**
   * 表格选中
   */

  const handleSelection = (data: TendbsingleModel, list: TendbsingleModel[]) => {
    state.selected = list;
  };

  /**
   * 集群启停
   */
  const handleSwitchCluster = (type: TicketTypesStrings, data: TendbsingleModel) => {
    if (!type) return;

    const isOpen = type === TicketTypes.MYSQL_SINGLE_ENABLE;
    const title = isOpen ? t('确定启用该集群') : t('确定禁用该集群');
    useInfoWithIcon({
      type: 'warnning',
      title,
      content: () => (
        <div style="word-break: all;">
          {
            isOpen
              ? <p>{t('集群【name】启用后将恢复访问', { name: data.cluster_name })}</p>
              : <p>{t('集群【name】被禁用后将无法访问_如需恢复访问_可以再次「启用」', { name: data.cluster_name })}</p>
          }
        </div>
      ),
      onConfirm: async () => {
        try {
          const params = {
            bk_biz_id: globalBizsStore.currentBizId,
            ticket_type: type,
            details: {
              cluster_ids: [data.id],
            },
          };
          await createTicket(params)
            .then((res) => {
              ticketMessage(res.id);
            });
          return true;
        } catch (_) {
          return false;
        }
      },
    });
  };

  /**
   * 删除集群
   */
  const handleDeleteCluster = (data: TendbsingleModel) => {
    const { cluster_name: name } = data;
    useInfoWithIcon({
      type: 'warnning',
      title: t('确定删除该集群'),
      confirmTxt: t('删除'),
      confirmTheme: 'danger',
      content: () => (
        <div style="word-break: all; text-align: left; padding-left: 16px;">
          <p>{t('集群【name】被删除后_将进行以下操作', { name })}</p>
          <p>{t('1_删除xx集群', { name })}</p>
          <p>{t('2_删除xx实例数据_停止相关进程', { name })}</p>
          <p>3. {t('回收主机')}</p>
        </div>
      ),
      onConfirm: async () => {
        try {
          const params = {
            bk_biz_id: globalBizsStore.currentBizId,
            ticket_type: TicketTypes.MYSQL_SINGLE_DESTROY,
            details: {
              cluster_ids: [data.id],
            },
          };
          await createTicket(params)
            .then((res) => {
              ticketMessage(res.id);
            });
          return true;
        } catch (_) {
          return false;
        }
      },
    });
  };

  onMounted(() => {
    if (!clusterId.value && route.query.id) {
      handleToDetails(Number(route.query.id));
    }
  });
</script>
<style lang="less" scoped>
  @import '@styles/mixins.less';

  .mysql-single-cluster-list-page {
    height: 100%;
    padding: 24px 0;
    margin: 0 24px;
    overflow: hidden;

    .operation-box {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 16px;

      .bk-search-select {
        flex: 1;
        max-width: 500px;
        min-width: 320px;
        margin-left: auto;
      }
    }

    .table-wrapper {
      background-color: white;

      .bk-table {
        height: 100% !important;
      }

      .bk-table-body {
        max-height: calc(100% - 100px);
      }

      .is-shrink-table {
        .bk-table-body {
          overflow: hidden auto;
        }
      }

      .table-wrapper {
        background-color: white;

        .bk-table {
          height: 100% !important;
        }

        .bk-table-body {
          max-height: calc(100% - 100px);
        }

        .is-shrink-table {
          .bk-table-body {
            overflow: hidden auto;
          }
        }
      }

      :deep(.cell) {
        line-height: normal !important;

        .domain {
          display: flex;
          align-items: center;
        }

        .db-icon-copy,
        .db-icon-edit {
          display: none;
          margin-left: 4px;
          color: @primary-color;
          cursor: pointer;
        }

        .operations-more {
          .db-icon-more {
            display: block;
            font-size: @font-size-normal;
            font-weight: bold;
            color: @default-color;
            cursor: pointer;

            &:hover {
              background-color: @bg-disable;
              border-radius: 2px;
            }
          }
        }
      }

      :deep(tr:hover) {
        .db-icon-copy,
        .db-icon-edit {
          display: inline-block !important;
        }
      }

      :deep(.is-offline) {
        a {
          color: @gray-color;
        }

        .cell {
          color: @disable-color;
        }
      }
    }
  }
</style>
<style lang="less">
  .cluster-name-container {
    display: flex;
    align-items: center;
    padding: 8px 0;
    overflow: hidden;

    .cluster-name {
      .bk-button {
        display: inline-block;
        width: 100%;
        overflow: hidden;

        .bk-button-text {
          display: inline-block;
          width: 100%;
          overflow: hidden;
          line-height: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      &__alias {
        color: @light-gray;
      }
    }

    .cluster-tags {
      display: flex;
      max-width: 150px;
      margin-left: 4px;
      align-items: center;

      .cluster-tag {
        margin: 2px 0;
        flex-shrink: 0;
      }
    }
  }
</style>
