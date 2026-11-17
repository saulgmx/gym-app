export const loose: any = 1;
export const evaluated = eval('1');
export const built = new Function('return 1');
export const html = <div dangerouslySetInnerHTML={{ __html: '<b>x</b>' }} />;
