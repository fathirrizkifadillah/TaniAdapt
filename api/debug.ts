export default async function handler(req: any, res: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    method: req.method,
    body: req.body,
    bodyType: typeof req.body,
    complete: req.complete,
    readableEnded: req.readableEnded
  }));
}
