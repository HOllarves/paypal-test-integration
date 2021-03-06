import { Request, Response, Router } from 'express'
const PaypalSdk = require('paypal-rest-sdk')

export default function () {

    const api: Router = Router()

    function webhookInit() {
        console.log('Configurating WebHooks')
        let webhooks = {
            url: 'https://paypal-test-integration.herokuapp.com/webhooks/subscription',
            event_types: [{
                name: 'BILLING.PLAN.CREATED'
            }, {
                name: 'BILLING.PLAN.UPDATED'
            }, {
                name: 'BILLING.SUBSCRIPTION.CREATED'
            }, {
                name: 'BILLING.SUBSCRIPTION.CANCELLED'
            }, {
                name: 'BILLING.SUBSCRIPTION.RE-ACTIVATED'
            }, {
                name: 'BILLING.SUBSCRIPTION.SUSPENDED'
            }, {
                name: 'BILLING.SUBSCRIPTION.UPDATED'
            }]
        }
        PaypalSdk.notification.webhook.create(webhooks, function (err: any, webhook: any) {
            if (err) {
                if (err.name == 'WEBHOOK_URL_ALREADY_EXISTS') {
                    console.log('WebHooks already exist')
                }
                console.error(JSON.stringify(err.response));
            } else {
                console.log('Create webhook Response');
                console.log(webhook);
            }
        })
    }


    console.log('Creating Router for [Webook::list_webhooks]')
    api.get('/', (req: Request, res: Response) => {
        PaypalSdk.notification.webhook.list((err: any, webhooks: any) => {
            if (err) {
                console.error(JSON.stringify(err.response))
            } else {
                res.json({
                    status: 200,
                    data: webhooks
                })
            }
        })
    })

    console.log('Creating Router for [Webook::billing_plan_webhooks]')
    api.post('/:userId', (req: Request, res: Response) => {
        console.log("Webhook user id = ", req.params.userId)
        console.log('Webhook event!')
        console.log(req.body.event_type)
        console.log(req.body.summary)
        console.log(req.body.resource.name)
        switch (req.body.event_type) {
            case 'BILLING.PLAN.CREATED':
                console.log('Billing plan created!')
                break
            case 'BILLING.PLAN.UPDATED':
                console.log('Billing plan updated!')
                break
            case 'BILLING.SUBSCRIPTION.CANCELLED':
                console.log('Billing plan cancelled!')
                break
            case 'BILLING.SUBSCRIPTION.CREATED':
                console.log('Billing subscription created!')
                req.body.bodyType = "created"
                let subscription = mapDataToSubscription(req.body)
                console.log("Subscription = ", subscription)
                break
            case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
                console.log('Billing subscription reactivated')
                break
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                console.log('Billing subscription suspended!')
                break
            case 'BILLING.SUBSCRIPTION.UPDATED':
                console.log('Billing subscription updated!')
                req.body.bodyType = "updated"
                req.body.previous_attributes = {
                    "date": "2016-04-28T11:29:31Z",
                    "periodStart": "2016-04-30T07:00:00Z",
                    "periodEnd": "2017-11-30T10:00:00Z",
                    "planId": "I-PE7JWXKGVN0R",
                    "planName": "desc",
                    "planAmount": "5.00",
                    "currency": "USD",
                    "previousPlanId": "",
                    "previousPlanName": "",
                    "previousPlanAmount": "",
                    "type": "Created",
                    "planInterval": "Monthly",
                    "status": "Closed"
                }
                let subscription_updated = mapDataToSubscription(req.body)
                console.log(subscription_updated)
                break
            case 'PAYMENT.AUTHORIZATION.CREATED':

            default:
                console.log('Some unknown webhook')
                break
        }
    })

    function mapDataToSubscription(response: any) {

        let subscription = {
            gatewayOriginalObject: '',
            date: '',
            periodStart: '',
            periodEnd: null,
            planId: '',
            planName: '',
            planAmount: '',
            currency: '',
            previousPlanId: '',
            previousPlanName: '',
            previousPlanAmount: '',
            type: '',
            planInterval: '',
            status: ''

        }
        subscription.gatewayOriginalObject = JSON.stringify(response);
        subscription.date = response.create_time;
        subscription.periodStart = response.resource.start_date;
        subscription.periodEnd = response.resource.agreement_details.final_payment_due_date;
        subscription.planId = response.resource.id;
        subscription.planName = response.resource.description;
        subscription.planAmount = response.resource.plan.payment_definitions[0].amount.value;
        subscription.currency = response.resource.plan.curr_code;
        if (response.bodyType == "updated") {
            subscription.previousPlanId = response.previous_attributes.planId;
            subscription.previousPlanName = response.previous_attributes.planName;
            subscription.previousPlanAmount = response.previous_attributes.planAmount;
            if (subscription.previousPlanAmount < subscription.planAmount) {
                subscription.type = 'Upgrade'
            } else if (subscription.previousPlanAmount > subscription.planAmount) {
                subscription.type = 'Downgrade'
            } else if (subscription.previousPlanAmount > subscription.planAmount) {
                subscription.type = 'Other'
            } else {
                subscription.type = 'Other'
            }
        } else if (response.bodyType == "created") {
            subscription.type = 'Created'
        }
        switch (response.resource.plan.payment_definitions[0].frequency) {
            case "Month":
                subscription.planInterval = 'Monthly'
                break;
            default:
                subscription.planInterval = '';
                break;
        }
        switch (response.resource.state) {
            case "CREATED":
                subscription.status = 'Active'
                break;
            default:
                subscription.status = 'Closed'
                break;
        }
        return subscription;
    }

    return {
        api: api,
        init: webhookInit
    }
}