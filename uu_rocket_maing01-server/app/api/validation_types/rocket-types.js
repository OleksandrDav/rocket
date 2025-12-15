/* eslint-disable */

const rocketCreateDtoInType = shape({
  name: string(3, 255).isRequired(),
  text: string(3, 4000).isRequired(),
});

const rocketListDtoInType = shape({
  pageInfo: shape({
    pageIndex: integer(0, 1000000000),
    pageSize: integer(1, 1000000000),
  }),
});
