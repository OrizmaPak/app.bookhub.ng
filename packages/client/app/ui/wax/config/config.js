import { DefaultSchema } from 'wax-prosemirror-core'

import {
  InlineAnnotationsService,
  ImageService,
  LinkService,
  ListsService,
  BaseService,
  DisplayBlockLevelService,
  TextBlockLevelService,
  SpecialCharactersService,
  BlockDropDownToolGroupService,
  FindAndReplaceService,
  // FindAndReplaceToolGroupService,
  FullScreenService,
  // disallowPasteImagesPlugin,
  CommentsService,
} from 'wax-prosemirror-services'

import { TablesService, tableEditing } from 'wax-table-service'

import charactersList from './charactersList'

const config = {
  MenuService: [
    {
      templateArea: 'mainMenuToolBar',
      toolGroups: [
        { name: 'Base', exclude: ['Save'] },
        'BlockDropDown',
        // { name: 'BlockQuoteTool', exclude: ['Lift'] },l
        { name: 'Lists', exclude: ['JoinUp'] },
        // {
        //   name: 'Text',
        //   exclude: [
        //     'ExtractPoetry',
        //     'ExtractProse',
        //     'ParagraphContinued',
        //     'Subscript',
        //     'SourceNote',
        //     'Paragraph',
        //   ],
        // },
        'Images',
        {
          name: 'Annotations',
          exclude: ['SmallCaps', 'StrikeThrough', 'Subscript', 'Superscript'],
        },
        // 'Tables',
        'SpecialCharacters',
        'FindAndReplaceTool',
        'FullScreen',
      ],
    },
  ],

  SchemaService: DefaultSchema,
  SpecialCharactersService: charactersList,
  PmPlugins: [tableEditing()],

  ImageService: { showAlt: true },

  services: [
    new CommentsService(),
    new InlineAnnotationsService(),
    new ImageService(),
    new LinkService(),
    new ListsService(),
    new BaseService(),
    new TablesService(),
    new DisplayBlockLevelService(),
    new TextBlockLevelService(),
    new SpecialCharactersService(),
    new BlockDropDownToolGroupService(),
    new FindAndReplaceService(),
    // new FindAndReplaceToolGroupService(),
    new FullScreenService(),
  ],
}

export default config
